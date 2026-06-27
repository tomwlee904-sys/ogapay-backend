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

  let wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, currency, balance: 0, lockedBalance: 0 },
    });
  }

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

const initiateWithdrawal = async (userId, { amount, currency, bankCode, bankName, accountNumber, accountName, walletAddress }) => {
  if (currency === 'NGN' && amount < 5000) {
    throw ApiError.badRequest('Minimum NGN withdrawal is ₦5,000');
  }

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
        metadata: { bankCode, bankName, accountNumber, accountName, walletAddress, netAmount },
      },
    });

    // Queue actual transfer — in production use a job queue (BullMQ/Redis)
    logger.info(`Withdrawal queued: ${reference} — ${amount} ${currency} for user ${userId}`);

    return { reference, fee, netAmount, status: 'PROCESSING', txId: tx.id };
  });
};

// ── Escrow (delegated to dedicated service) ─────

const escrowService = require('./escrow.service');
const { lockFundsForTask, releaseEscrow, refundEscrow, getEscrowStatus, getEscrowHistory } = escrowService;

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

// ── Referral reward ─────────────────────────────
const REFERRAL_BONUS_AMOUNT = 1000;

const rewardForReferral = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, referredById: true, referralRewardedAt: true, isEmailVerified: true, firstName: true },
  });

  if (!user || !user.referredById) return null;
  if (user.referralRewardedAt) return null;

  // Milestone check: email verified OR KYC approved at any tier
  const kyc = await prisma.kycVerification.findUnique({
    where: { userId },
    select: { status: true, kycTier: true },
  });

  const milestoneReached = user.isEmailVerified || (kyc?.status === 'APPROVED' && (kyc?.kycTier || 0) >= 1);
  if (!milestoneReached) return null;

  return prisma.$transaction(async (db) => {
    const referrerWallet = await db.wallet.findUnique({
      where: { userId_currency: { userId: user.referredById, currency: 'NGN' } },
    });
    if (!referrerWallet) return null;

    const newBalance = parseFloat(referrerWallet.balance) + REFERRAL_BONUS_AMOUNT;
    const reference = `OGA-REF-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    await db.wallet.update({
      where: { id: referrerWallet.id },
      data: { balance: newBalance },
    });

    await db.transaction.create({
      data: {
        userId: user.referredById,
        walletId: referrerWallet.id,
        type: 'REFERRAL_BONUS',
        status: 'COMPLETED',
        amount: REFERRAL_BONUS_AMOUNT,
        currency: 'NGN',
        reference,
        balanceBefore: referrerWallet.balance,
        balanceAfter: newBalance,
        description: `Referral bonus for ${user.firstName}'s milestone`,
        completedAt: new Date(),
        metadata: { referredUserId: userId },
      },
    });

    await db.user.update({
      where: { id: userId },
      data: { referralRewardedAt: new Date() },
    });

    await db.notification.create({
      data: {
        userId: user.referredById,
        type: 'REFERRAL_BONUS',
        title: '🎉 Referral Bonus Credited!',
        body: `You earned ₦${REFERRAL_BONUS_AMOUNT.toLocaleString()} for ${user.firstName}'s milestone.`,
        data: { referredUserId: userId, amount: REFERRAL_BONUS_AMOUNT, reference },
      },
    });

    logger.info(`Referral bonus credited: ${reference} — ₦${REFERRAL_BONUS_AMOUNT} to referrer of user ${userId}`);
    return { reference, amount: REFERRAL_BONUS_AMOUNT };
  });
};

module.exports = {
  getUserWallets,
  initiateDeposit,
  confirmDeposit,
  initiateWithdrawal,
  lockFundsForTask,
  releaseEscrow,
  refundEscrow,
  getEscrowStatus,
  getEscrowHistory,
  formatAmount,
  rewardForReferral,
};
