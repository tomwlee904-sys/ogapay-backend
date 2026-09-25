'use strict';

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');
const { holdFunds } = require('../utils/ledger');
const { logger } = require('../utils/logger');

const FLW_BASE = 'https://api.flutterwave.com/v3';
const FLW_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;

const flwRequest = axios.create({
  baseURL: FLW_BASE,
  headers: {
    Authorization: `Bearer ${FLW_SECRET}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ─── Helpers ────────────────────────────────────────────────

const createAuditLog = async (db, { userId, action, description, amount, currency, reference, metadata, ipAddress }) => {
  await db.auditLog.create({
    data: { userId, action, description, amount, currency, reference, metadata, ipAddress },
  });
};

// ─── Flutterwave Customer ──────────────────────────────────

const findOrCreateCustomer = async (db, userId) => {
  const existing = await db.flutterwaveCustomer.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true, phone: true },
  });
  if (!user) throw ApiError.notFound('User not found');

  const { data } = await flwRequest.post('/customers', {
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    phonenumber: user.phone || undefined,
  });

  if (data.status !== 'success') {
    throw ApiError.internal('Failed to create Flutterwave customer');
  }

  const customer = await db.flutterwaveCustomer.create({
    data: {
      userId,
      flutterwaveId: data.data.id,
      customerEmail: data.data.email,
      customerPhone: user.phone,
      customerName: data.data.name,
    },
  });

  return customer;
};

// ─── Virtual Account (DVA) ─────────────────────────────────

const createVirtualAccount = async (userId, ipAddress) => {
  return prisma.$transaction(async (db) => {
    const existingDva = await db.virtualAccount.findFirst({
      where: { userId, isActive: true },
    });
    if (existingDva) {
      return existingDva;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true },
    });
    if (!user) throw ApiError.notFound('User not found');

    const kyc = await db.kycVerification.findUnique({
      where: { userId },
      select: { idType: true, idNumber: true, status: true },
    });
    if (!kyc || kyc.status !== 'APPROVED' || !kyc.idNumber) {
      throw ApiError.badRequest('Please complete KYC verification first to create a virtual account');
    }

    const tx_ref = `DVA-${uuidv4().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    let flwRes;
    try {
      const body = {
        email: user.email,
        is_permanent: true,
        tx_ref,
        narration: `OgaPay Wallet`,
        phonenumber: user.phone || undefined,
        firstname: user.firstName || undefined,
        lastname: user.lastName || undefined,
      };
      if (kyc.idType === 'BVN') body.bvn = kyc.idNumber;
      else body.nin = kyc.idNumber;
      flwRes = await flwRequest.post('/virtual-account-numbers', body);
    } catch (flwErr) {
      const flwMsg = flwErr?.response?.data?.message || flwErr?.response?.data || flwErr.message;
      logger.error(`Flutterwave DVA error: ${JSON.stringify(flwMsg)}`);
      throw ApiError.internal(`Flutterwave: ${flwMsg}`);
    }

    const data = flwRes.data;
    if (data.status !== 'success') {
      throw ApiError.internal(`Flutterwave create DVA failed: ${data.message || data.status}`);
    }

    const vaData = data.data;

    const flwCustomerId = vaData.customer?.id || 0;
    const cust = await db.flutterwaveCustomer.upsert({
      where: { userId },
      update: { flutterwaveId: Number(flwCustomerId), customerEmail: user.email },
      create: { userId, flutterwaveId: Number(flwCustomerId), customerEmail: user.email },
    });
    const customerId = cust.id;

    const virtualAccount = await db.virtualAccount.create({
      data: {
        userId,
        flutterwaveCustomerId: customerId,
        accountNumber: String(vaData.account_number),
        bankName: vaData.bank_name,
        bankCode: vaData.bank_code || null,
        accountName: vaData.account_name || null,
        orderRef: vaData.order_ref || tx_ref,
      },
    });

    await createAuditLog(db, {
      userId,
      action: 'create_dva',
      description: `Virtual account created: ${vaData.bank_name} • ${vaData.account_number}`,
      ipAddress,
    });

    logger.info(`DVA created for user ${userId}: ${vaData.bank_name} ${vaData.account_number}`);
    return virtualAccount;
  }, { timeout: 20000 });
};

const getVirtualAccount = async (userId) => {
  return prisma.virtualAccount.findFirst({
    where: { userId, isActive: true },
  });
};

const deactivateVirtualAccount = async (userId) => {
  return prisma.virtualAccount.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });
};

// ─── Bank Account ──────────────────────────────────────────

const listBanks = async (country = 'NG') => {
  const { data } = await flwRequest.get(`/banks/${country}`);
  if (data.status !== 'success') {
    throw ApiError.internal('Failed to fetch bank list');
  }
  return data.data;
};

const verifyAccountNumber = async (accountNumber, bankCode) => {
  const { data } = await flwRequest.post('/accounts/resolve', {
    account_number: accountNumber,
    account_bank: bankCode,
  });
  if (data.status !== 'success') {
    throw ApiError.badRequest('Could not verify account number. Check and try again.');
  }
  return data.data;
};

const addBankAccount = async (userId, { bankCode, bankName, accountNumber, accountName, setDefault }, ipAddress) => {
  return prisma.$transaction(async (db) => {
    const verification = await verifyAccountNumber(accountNumber, bankCode);

    const existing = await db.bankAccount.findFirst({
      where: { userId, accountNumber, bankCode, deletedAt: null },
    });
    if (existing) {
      throw ApiError.conflict('This bank account is already saved');
    }

    if (setDefault) {
      await db.bankAccount.updateMany({
        where: { userId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const bank = await db.bankAccount.create({
      data: {
        userId,
        bankName,
        bankCode,
        accountNumber,
        accountName: accountName || verification.account_name,
        isDefault: setDefault || false,
        isVerified: true,
      },
    });

    await createAuditLog(db, {
      userId,
      action: 'add_bank',
      description: `Bank account added: ${bankName} • ${accountNumber}`,
      ipAddress,
    });

    return bank;
  });
};

const getUserBankAccounts = async (userId) => {
  return prisma.bankAccount.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
};

const deleteBankAccount = async (userId, bankId) => {
  return prisma.$transaction(async (db) => {
    const bank = await db.bankAccount.findFirst({
      where: { id: bankId, userId, deletedAt: null },
    });
    if (!bank) throw ApiError.notFound('Bank account not found');

    await db.bankAccount.update({
      where: { id: bankId },
      data: { deletedAt: new Date(), isDefault: false },
    });

    await createAuditLog(db, {
      userId,
      action: 'delete_bank',
      description: `Bank account removed: ${bank.bankName} • ${bank.accountNumber}`,
    });

    return { deleted: true };
  });
};

const setDefaultBankAccount = async (userId, bankId) => {
  return prisma.$transaction(async (db) => {
    const bank = await db.bankAccount.findFirst({
      where: { id: bankId, userId, deletedAt: null },
    });
    if (!bank) throw ApiError.notFound('Bank account not found');

    await db.bankAccount.updateMany({
      where: { userId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });

    await db.bankAccount.update({
      where: { id: bankId },
      data: { isDefault: true },
    });

    return { setDefault: true, bankId };
  });
};

// ─── Flutterwave Transfer ─────────────────────────────────

const initiateTransfer = async (userId, { bankAccountId, amount, currency }, ipAddress) => {
  if (currency !== 'NGN') throw ApiError.badRequest('Only NGN transfers supported');
  amount = Number(amount);
  if (!(amount > 0)) throw ApiError.badRequest('Enter a valid amount');

  const bank = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, userId, deletedAt: null },
  });
  if (!bank) throw ApiError.notFound('Bank account not found');

  const fee = Math.max(100, amount * 0.015);
  const netAmount = amount - fee;
  if (netAmount <= 0) throw ApiError.badRequest('Amount is too small to cover the transfer fee');
  const reference = `OGA-WIT-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  const bankMeta = {
    bankName: bank.bankName,
    bankCode: bank.bankCode,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    netAmount,
  };

  // 1. Hold the funds and record the withdrawal, committed before any money
  //    moves. The Flutterwave call happens outside the DB transaction, so a slow
  //    response can't roll the hold back after the money was sent.
  const { tx, wallet } = await prisma.$transaction(async (db) => {
    const wallet = await db.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
    if (!wallet) throw ApiError.notFound('Wallet not found');

    if (!(await holdFunds(db, wallet.id, amount))) {
      throw ApiError.badRequest('Insufficient available balance');
    }

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
        balanceAfter: parseFloat(String(wallet.balance)) - amount,
        description: `Withdrawal to ${bank.bankName} • ${bank.accountNumber}`,
        metadata: bankMeta,
      },
    });
    return { tx, wallet };
  });

  // 2. Ask Flutterwave to pay
  let transferResult;
  try {
    const { data } = await flwRequest.post('/transfers', {
      account_bank: bank.bankCode,
      account_number: bank.accountNumber,
      amount: netAmount,
      narration: 'OgaPay Withdrawal',
      currency: 'NGN',
      reference,
      callback_url: `${process.env.BASE_URL || 'https://api.ogapay.io'}/api/v1/webhooks/flutterwave`,
      debit_currency: 'NGN',
    });

    if (data.status !== 'success') {
      const err = new Error(data.message || 'Flutterwave transfer failed');
      err.rejected = true;
      throw err;
    }
    transferResult = data.data;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;

    if (err.rejected || (status >= 400 && status < 500)) {
      // Flutterwave refused the transfer, so nothing was sent: release the hold.
      await prisma.$transaction(async (db) => {
        const { count } = await db.transaction.updateMany({
          where: { id: tx.id, status: 'PROCESSING' },
          data: { status: 'FAILED', externalRef: String(message).slice(0, 190) },
        });
        if (count === 1) {
          await db.wallet.update({
            where: { id: wallet.id },
            data: { lockedBalance: { decrement: amount } },
          });
        }
        await createAuditLog(db, {
          userId,
          action: 'withdrawal_failed',
          description: `Withdrawal of ${amount} ${currency} to ${bank.bankName} failed: ${message}`,
          amount,
          currency,
          reference,
          ipAddress,
        });
      });
      throw ApiError.badRequest(`Withdrawal failed: ${message}`);
    }

    // Timeout, network error or 5xx: the transfer may or may not exist. Keep the
    // hold; the transfer webhook settles it either way.
    logger.error(`Withdrawal ${reference}: Flutterwave outcome unknown (${message}); funds stay held until the transfer webhook arrives`);
    return { reference, fee, netAmount, status: 'PROCESSING', txId: tx.id };
  }

  await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      externalRef: String(transferResult.id),
      metadata: { ...bankMeta, flutterwaveId: transferResult.id },
    },
  });

  await createAuditLog(prisma, {
    userId,
    action: 'withdrawal',
    description: `Withdrawal of ${amount} ${currency} to ${bank.bankName} • ${bank.accountNumber}`,
    amount,
    currency,
    reference,
    metadata: { flutterwaveId: transferResult.id, netAmount },
    ipAddress,
  });

  logger.info(`Withdrawal initiated: ${reference} — ${amount} ${currency} for user ${userId}`);
  return { reference, fee, netAmount, status: 'PROCESSING', txId: tx.id, flutterwaveId: transferResult.id };
};

// ─── Webhook: Handle DVA Credit Notification ───────────────

const handleDvaCredit = async (event) => {
  const { data } = event;
  const accountNumber = data?.account_number;
  const amount = parseFloat(data?.amount || data?.calculated_charge);
  if (!accountNumber || amount == null || amount <= 0) {
    logger.warn('DVA credit webhook missing/invalid account_number or amount', { data });
    return;
  }

  const flutterwaveRef = String(data?.id);
  const reference = `DVA-${flutterwaveRef}`;

  const va = await prisma.virtualAccount.findFirst({
    where: { accountNumber, isActive: true },
  });
  if (!va) {
    logger.warn(`DVA credit for unknown account: ${accountNumber}`);
    return;
  }

  const existingTx = await prisma.transaction.findFirst({
    where: { OR: [{ reference }, { externalRef: flutterwaveRef }] },
  });
  if (existingTx) return;

  // Two deliveries at the same moment both pass the check above; the unique
  // reference makes the second insert fail and roll its credit back.
  await prisma.$transaction(async (db) => {
    const wallet = await db.wallet.upsert({
      where: { userId_currency: { userId: va.userId, currency: 'NGN' } },
      update: {},
      create: { userId: va.userId, currency: 'NGN', balance: 0, lockedBalance: 0, pendingBalance: 0 },
    });

    const credited = await db.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        pendingBalance: { decrement: amount <= Number(wallet.pendingBalance) ? amount : Number(wallet.pendingBalance) },
      },
    });
    const balAfter = Number(credited.balance);
    const balBefore = balAfter - amount;

    await db.transaction.create({
      data: {
        userId: va.userId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        amount,
        currency: 'NGN',
        reference,
        externalRef: flutterwaveRef,
        provider: 'FLUTTERWAVE',
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Deposit via DVA (${va.bankName})`,
        completedAt: new Date(),
      },
    });

    await createAuditLog(db, {
      userId: va.userId,
      action: 'deposit',
      description: `Deposit of NGN ${amount} via DVA ${va.bankName} • ${va.accountNumber}`,
      amount,
      currency: 'NGN',
      reference,
      metadata: { flutterwaveRef, accountNumber, bankName: va.bankName },
    });
  }).catch((err) => {
    if (err.code === 'P2002') return logger.info(`DVA credit ${reference} already recorded`);
    throw err;
  });
};

// ─── Webhook: Handle Transfer Status Update ────────────────

const handleTransferUpdate = async (event) => {
  const { data } = event;
  const reference = data?.reference;
  const status = data?.status;
  const flutterwaveId = String(data?.id);

  if (!reference || !status) return;

  const tx = await prisma.transaction.findFirst({
    where: { OR: [{ reference }, { externalRef: flutterwaveId }], status: 'PROCESSING' },
  });
  if (!tx) return;

  if (status === 'SUCCESSFUL') {
    await prisma.$transaction(async (db) => {
      // Settle exactly once, even if Flutterwave delivers the webhook twice
      const { count } = await db.transaction.updateMany({
        where: { id: tx.id, status: 'PROCESSING' },
        data: { status: 'COMPLETED', externalRef: flutterwaveId, completedAt: new Date() },
      });
      if (count === 0) return;

      // The money has left: take it out of the balance as well as the hold
      await db.wallet.update({
        where: { id: tx.walletId },
        data: {
          balance: { decrement: Number(tx.amount) },
          lockedBalance: { decrement: Number(tx.amount) },
        },
      });
    });
  } else if (['FAILED', 'CANCELLED'].includes(status)) {
    await prisma.$transaction(async (db) => {
      const { count } = await db.transaction.updateMany({
        where: { id: tx.id, status: 'PROCESSING' },
        data: { status: 'FAILED', externalRef: flutterwaveId },
      });
      if (count === 0) return;

      // Nothing was paid: release the hold
      await db.wallet.update({
        where: { id: tx.walletId },
        data: { lockedBalance: { decrement: Number(tx.amount) } },
      });
    });
  }
};

module.exports = {
  findOrCreateCustomer,
  createVirtualAccount,
  getVirtualAccount,
  deactivateVirtualAccount,
  listBanks,
  verifyAccountNumber,
  addBankAccount,
  getUserBankAccounts,
  deleteBankAccount,
  setDefaultBankAccount,
  initiateTransfer,
  handleDvaCredit,
  handleTransferUpdate,
};
