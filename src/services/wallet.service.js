'use strict';

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');

// ── Get user wallets ───────────────────────────

const getUserWallets = async (userId) => {
  return prisma.wallet.findMany({
    where: { userId, isActive: true },
    orderBy: { currency: 'asc' },
  });
};

// ── Initiate deposit (Paystack) ────────────────

const initiateDeposit = async (userId, { amount, currency, provider, callbackUrl }) => {
  if (currency !== 'NGN' && provider !== 'CRYPTO') {
    throw ApiError.badRequest('Non-NGN deposits must use CRYPTO provider');
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!wallet) throw ApiError.notFound('Wallet not found');

  const reference = `OGA-DEP-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

  // Create pending transaction
  const tx = await prisma.transaction.create({
    data: {
      userId,
      walletId: wallet.id,
      type: 'DEPOSIT',
      status: 'PENDING',
      amount,
      currency,
      reference,
      provider,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance, // Updated on webhook confirmation
      description: `Deposit via ${provider}`,
    },
  });

  // Build provider payload
  if (provider === 'PAYSTACK') {
    const paystackPayload = await initializePaystackPayment({
      email: (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })).email,
      amount: amount * 100, // Paystack uses kobo
      reference,
      callbackUrl,
      metadata: { userId, walletId: wallet.id, txId: tx.id },
    });

    return { reference, provider, paymentUrl: paystackPayload.authorization_url, txId: tx.id };
  }

  if (provider === 'FLUTTERWAVE') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true, phone: true } });
    const fwPayload = await initializeFlutterwavePayment({
      tx_ref: reference,
      amount,
      currency: 'NGN',
      redirect_url: callbackUrl,
      customer: { email: user.email, name: `${user.firstName} ${user.lastName}`, phonenumber: user.phone },
      customizations: { title: 'OgaPay Deposit', logo: 'https://ogapay.io/logo.png' },
    });
    return { reference, provider, paymentUrl: fwPayload.link, txId: tx.id };
  }

  // Crypto — return a wallet address
  const cryptoWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  return { reference, provider: 'CRYPTO', depositAddress: cryptoWallet?.walletAddress || process.env.PLATFORM_WALLET_ADDRESS, txId: tx.id };
};

// ── Confirm deposit (called from webhook) ───────

const confirmDeposit = async (reference, providerRef) => {
  const tx = await prisma.transaction.findUnique({ where: { reference } });
  if (!tx) throw ApiError.notFound('Transaction not found');
  if (tx.status !== 'PENDING') return tx; // Idempotent

  const wallet = await prisma.wallet.findUnique({ where: { id: tx.walletId } });

  return prisma.$transaction(async (db) => {
    const newBalance = parseFloat(wallet.balance) + parseFloat(tx.amount);

    await db.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    const updated = await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'COMPLETED',
        externalRef: providerRef,
        balanceAfter: newBalance,
        completedAt: new Date(),
      },
    });

    await db.notification.create({
      data: {
        userId: tx.userId,
        type: 'DEPOSIT_CONFIRMED',
        title: '💰 Deposit Confirmed',
        body: `Your deposit of ${formatAmount(tx.amount, tx.currency)} has been confirmed.`,
        data: { txId: tx.id, amount: tx.amount, currency: tx.currency },
      },
    });

    logger.info(`Deposit confirmed: ${reference} — ${tx.amount} ${tx.currency}`);
    return updated;
  });
};

// ── Withdraw ───────────────────────────────────

const initiateWithdrawal = async (userId, { amount, currency, bankCode, accountNumber, walletAddress }) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!wallet) throw ApiError.notFound('Wallet not found');

  const availableBalance = parseFloat(wallet.balance) - parseFloat(wallet.lockedBalance);
  if (availableBalance < amount) {
    throw ApiError.badRequest(`Insufficient balance. Available: ${formatAmount(availableBalance, currency)}`);
  }

  const fee = calculateWithdrawalFee(amount, currency);
  const netAmount = amount - fee;
  const reference = `OGA-WIT-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

  return prisma.$transaction(async (db) => {
    // Lock funds
    await db.wallet.update({
      where: { id: wallet.id },
      data: { lockedBalance: { increment: amount } },
    });

    const tx = await db.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        status: 'PROCESSING',
        amount,
        fee,
        currency,
        reference,
        balanceBefore: wallet.balance,
        balanceAfter: parseFloat(wallet.balance) - amount,
        description: `Withdrawal via ${currency === 'NGN' ? 'bank transfer' : 'crypto'}`,
        metadata: { bankCode, accountNumber, walletAddress, netAmount },
      },
    });

    // Queue actual transfer — in production use a job queue (BullMQ/Redis)
    logger.info(`Withdrawal queued: ${reference} — ${amount} ${currency} for user ${userId}`);

    return { reference, fee, netAmount, status: 'PROCESSING', txId: tx.id };
  });
};

// ── Escrow for task payment ────────────────────

const lockFundsForTask = async (userId, taskId, amount, currency) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!wallet) throw ApiError.notFound('Wallet not found');

  const available = parseFloat(wallet.balance) - parseFloat(wallet.lockedBalance);
  const platformFee = (amount * PLATFORM_FEE_PERCENT) / 100;
  const totalRequired = amount + platformFee;

  if (available < totalRequired) {
    throw ApiError.badRequest(
      `Insufficient funds. Required: ${formatAmount(totalRequired, currency)} (includes ${PLATFORM_FEE_PERCENT}% platform fee). Available: ${formatAmount(available, currency)}`
    );
  }

  return prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: platformFee },
        lockedBalance: { increment: amount },
      },
    });

    const tx = await db.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'TASK_PAYMENT',
        status: 'PENDING',
        amount: totalRequired,
        fee: platformFee,
        currency,
        reference: `OGA-ESCROW-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        balanceBefore: wallet.balance,
        balanceAfter: parseFloat(wallet.balance) - platformFee,
        taskId,
        description: `Escrow for task ${taskId}`,
        metadata: { taskAmount: amount, platformFee },
      },
    });

    return { txId: tx.id, escrowed: totalRequired, fee: platformFee };
  });
};

// Release escrowed funds to worker
const releaseEscrow = async (taskId, workerId, amount, currency) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { posterId: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const [workerWallet, posterWallet] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId_currency: { userId: workerId, currency } } }),
    prisma.wallet.findUnique({ where: { userId_currency: { userId: task.posterId, currency } } }),
  ]);
  if (!workerWallet) throw ApiError.notFound('Worker wallet not found');
  if (!posterWallet) throw ApiError.notFound('Poster wallet not found');

  const reference = `OGA-PAY-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  return prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { id: posterWallet.id },
      data: {
        balance: { decrement: amount },
        lockedBalance: { decrement: amount },
      },
    });

    await db.wallet.update({
      where: { id: workerWallet.id },
      data: { balance: { increment: amount } },
    });

    await db.transaction.create({
      data: {
        userId: workerId,
        walletId: workerWallet.id,
        type: 'TASK_PAYMENT',
        status: 'COMPLETED',
        amount,
        currency,
        reference,
        balanceBefore: workerWallet.balance,
        balanceAfter: parseFloat(workerWallet.balance) + amount,
        taskId,
        completedAt: new Date(),
        description: `Payment for task ${taskId}`,
      },
    });

    await db.workerProfile.update({
      where: { userId: workerId },
      data: { totalEarned: { increment: amount }, tasksCompleted: { increment: 1 } },
    });

    await db.notification.create({
      data: {
        userId: workerId,
        type: 'TASK_PAYMENT_RECEIVED',
        title: 'Payment Received!',
        body: `You received ${formatAmount(amount, currency)} for completing a task.`,
        data: { taskId, amount, currency },
      },
    });

    logger.info(`Escrow released: task ${taskId} -> worker ${workerId} - ${amount} ${currency}`);
  });
};

// ── Helpers ────────────────────────────────────

const formatAmount = (amount, currency) => {
  const num = parseFloat(amount);
  if (currency === 'NGN') return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  return `${num.toFixed(6)} ${currency}`;
};

const calculateWithdrawalFee = (amount, currency) => {
  if (currency === 'NGN') return Math.max(100, amount * 0.015); // 1.5%, min ₦100
  return amount * 0.01; // 1% for crypto
};

// ── Paystack / Flutterwave helpers (wrappers) ──

const initializePaystackPayment = async ({ email, amount, reference, callbackUrl, metadata }) => {
  const axios = require('axios');
  const { data } = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    { email, amount, reference, callback_url: callbackUrl, metadata },
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  );
  if (!data.status) throw ApiError.internal('Failed to initialize Paystack payment');
  return data.data;
};

const initializeFlutterwavePayment = async (payload) => {
  const axios = require('axios');
  const { data } = await axios.post(
    'https://api.flutterwave.com/v3/payments',
    payload,
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
  );
  if (data.status !== 'success') throw ApiError.internal('Failed to initialize Flutterwave payment');
  return data.data;
};

module.exports = {
  getUserWallets,
  initiateDeposit,
  confirmDeposit,
  initiateWithdrawal,
  lockFundsForTask,
  releaseEscrow,
  formatAmount,
};
