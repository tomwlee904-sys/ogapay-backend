'use strict';

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');
const { createNotification, NOTIF_TYPES } = require("../utils/notify");
const { fetchPrices, FALLBACK_PRICES } = require('./price.service');

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

    await createNotification({
      userId: tx.userId,
      type: NOTIF_TYPES.DEPOSIT_CONFIRMED,
      title: '💰 Deposit Confirmed',
      body: `Your deposit of ${formatAmount(tx.amount, tx.currency)} has been confirmed.`,
      data: { txId: tx.id, amount: tx.amount, currency: tx.currency },
      db,
    });

    // Auto-convert USDC to NGN if user has the preference enabled
    if (tx.currency === 'USDC') {
      await autoConvertUsdcToNgn(tx.userId, { db });
    }

    logger.info(`Deposit confirmed: ${reference} — ${tx.amount} ${tx.currency}`);
    return updated;
  });
};

// ── Withdraw ───────────────────────────────────

const initiateWithdrawal = async (userId, { amount, currency, bankCode, bankName, accountNumber, accountName, walletAddress }) => {
  // Minimum withdrawal check: ₦5,000 NGN-equivalent using live rates
  const MIN_NGN = 5000;
  let minAmt;
  if (currency === 'NGN') {
    minAmt = MIN_NGN;
  } else {
    try {
      const prices = await fetchPrices();
      const rateKey = currency.toLowerCase();
      const rate = prices?.[rateKey]?.ngn;
      if (rate && rate > 0) {
        minAmt = MIN_NGN / rate;
      } else {
        // Live rate invalid — use static fallback
        const fallbackRates = { USDC: FALLBACK_PRICES.usdc.ngn, SOL: FALLBACK_PRICES.sol.ngn };
        minAmt = MIN_NGN / (fallbackRates[currency] || fallbackRates.USDC);
        logger.warn(`Withdrawal min check using static fallback rate for ${currency} (live rate unavailable)`);
      }
    } catch (err) {
      // Live fetch failed — use static fallback
      const fallbackRates = { USDC: FALLBACK_PRICES.usdc.ngn, SOL: FALLBACK_PRICES.sol.ngn };
      minAmt = MIN_NGN / (fallbackRates[currency] || fallbackRates.USDC);
      logger.warn(`Withdrawal min check: live rate fetch failed, using fallback for ${currency}: ${err.message}`);
    }
  }
  if (amount < minAmt) {
    throw ApiError.badRequest('Minimum withdrawal is ' + formatAmount(minAmt, currency));
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
const REFERRAL_CAP = 20;
const SIGNUP_BONUS_AMOUNT = 1000;

// ── Referral reward (with 20-referral cap) ──────

const rewardForReferral = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, referredById: true, referralRewardedAt: true,
      referralMilestoneReachedAt: true, isEmailVerified: true, firstName: true,
    },
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

  // Cap check + payment inside a single $transaction for atomicity
  return prisma.$transaction(async (db) => {
    // Count referrer's already-paid referrals inside the transaction
    const paidCount = await db.user.count({
      where: { referredById: user.referredById, referralRewardedAt: { not: null } },
    });

    // Check if the cap has been reached
    if (paidCount >= REFERRAL_CAP) {
      // Cap reached — record milestone but skip payment
      await db.user.update({
        where: { id: userId },
        data: { referralMilestoneReachedAt: new Date() },
      });

      logger.info(
        `Referral cap reached for referrer ${user.referredById} — ` +
        `milestone recorded for user ${userId} but bonus skipped (${paidCount}/${REFERRAL_CAP})`
      );
      return { capped: true, paidCount };
    }

    const referrerWallet = await db.wallet.findUnique({
      where: { userId_currency: { userId: user.referredById, currency: 'NGN' } },
    });
    if (!referrerWallet) return null;

    // Daily velocity check: rolling 24h sum of REFERRAL_BONUS for referrer
    const dailySum = await db.transaction.aggregate({
      where: {
        userId: user.referredById,
        type: 'REFERRAL_BONUS',
        status: 'COMPLETED',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    });
    const dailyTotal = dailySum._sum.amount ? parseFloat(dailySum._sum.amount) : 0;
    const DAILY_THRESHOLD = 5000;
    const PENALTY_AMOUNT = 10;
    const isPenalized = dailyTotal >= DAILY_THRESHOLD;
    const effectiveAmount = isPenalized ? REFERRAL_BONUS_AMOUNT - PENALTY_AMOUNT : REFERRAL_BONUS_AMOUNT;
    const descSuffix = isPenalized ? ' (cooldown penalty applied)' : '';

    const newBalance = parseFloat(referrerWallet.balance) + effectiveAmount;
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
        amount: effectiveAmount,
        currency: 'NGN',
        reference,
        balanceBefore: referrerWallet.balance,
        balanceAfter: newBalance,
        description: `Referral bonus for ${user.firstName}'s milestone${descSuffix}`,
        completedAt: new Date(),
        metadata: { referredUserId: userId, dailyVelocityPenalized: isPenalized, dailyTotal },
      },
    });

    await db.user.update({
      where: { id: userId },
      data: { referralRewardedAt: new Date() },
    });

    await createNotification({
      userId: user.referredById,
      type: NOTIF_TYPES.REFERRAL_BONUS,
      title: isPenalized ? '🔶 Referral Bonus Credited (reduced rate)' : '🎉 Referral Bonus Credited!',
      body: `You earned ₦${effectiveAmount.toLocaleString()} for ${user.firstName}'s milestone.${isPenalized ? ' (Cooldown penalty: ₦10 deducted due to high daily volume)' : ''}`,
      data: { referredUserId: userId, amount: effectiveAmount, reference, dailyVelocityPenalized: isPenalized },
      db,
    });

    logger.info(`Referral bonus credited: ${reference} — ₦${effectiveAmount} to referrer of user ${userId}${isPenalized ? ' (daily velocity penalty applied, dailyTotal=' + dailyTotal + ')' : ''}`);
    return { reference, amount: effectiveAmount, dailyVelocityPenalized: isPenalized };
  });
};

// ── Signup bonus (₦1,000 on NIN or BVN verification) ───

const rewardSignupBonus = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, signupBonusPaid: true },
  });

  if (!user || user.signupBonusPaid) return null;

  // Verify user has approved NIN or BVN KYC (tier >= 1)
  const kyc = await prisma.kycVerification.findUnique({
    where: { userId },
    select: { status: true, kycTier: true },
  });

  const isVerified = kyc?.status === 'APPROVED' && (kyc?.kycTier || 0) >= 1;
  if (!isVerified) return null;

  return prisma.$transaction(async (db) => {
    const wallet = await db.wallet.findUnique({
      where: { userId_currency: { userId, currency: 'NGN' } },
    });
    if (!wallet) return null;

    const newBalance = parseFloat(wallet.balance) + SIGNUP_BONUS_AMOUNT;
    const reference = `OGA-SGN-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    await db.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    await db.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'SIGNUP_BONUS',
        status: 'COMPLETED',
        amount: SIGNUP_BONUS_AMOUNT,
        currency: 'NGN',
        reference,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: 'Signup bonus for completing KYC verification',
        completedAt: new Date(),
      },
    });

    await db.user.update({
      where: { id: userId },
      data: { signupBonusPaid: true },
    });

    await createNotification({
      userId,
      type: NOTIF_TYPES.SIGNUP_BONUS,
      title: '🎉 ₦1,000 Signup Bonus Credited!',
      body: 'You earned ₦1,000 for verifying your identity. Welcome to OgaPay!',
      data: { amount: SIGNUP_BONUS_AMOUNT, reference },
      db,
    });

    logger.info(`Signup bonus credited: ${reference} — ₦${SIGNUP_BONUS_AMOUNT} to user ${userId}`);
    return { reference, amount: SIGNUP_BONUS_AMOUNT };
  });
};


// ── Auto-convert USDC to NGN (for users with preference enabled) ────

const autoConvertUsdcToNgn = async (userId, options = {}) => {
  /**
   * Checks user.preferences.autoConvert. If enabled, converts the user's entire
   * USDC balance to NGN at the current exchange rate.
   *
   * **Atomicity / race-safety:**
   * - When called with `options.db` (inside an outer $transaction), uses the
   *   passed transaction client directly -- the outer transaction provides
   *   serializable isolation.
   * - When called standalone (escrow path), wraps debit/credit in its own
   *   $transaction and uses `updateMany` with an optimistic-lock WHERE clause
   *   (`balance: usdcBalance`) so that if two concurrent calls read the same
   *   balance, only one wins; the other's `result.count` will be 0 and it
   *   safely no-ops (next credit event will retry).
   *
   * Must never throw -- failures are logged and the USDC balance is left as-is.
   */
  try {
    // -- 1. Gate check (runs outside transaction -- harmless if slightly stale) --
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) return;
    const prefs = (typeof user.preferences === 'object' && user.preferences) ? user.preferences : {};
    if (!prefs.autoConvert) return;

    // -- 2. Define the debit/credit logic --
    const executeConversion = async (db) => {
      // Re-read user inside transaction to be safe
      const innerUser = await db.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      if (!innerUser) return null;
      const innerPrefs = (typeof innerUser.preferences === 'object' && innerUser.preferences) ? innerUser.preferences : {};
      if (!innerPrefs.autoConvert) return null;

      const usdcWallet = await db.wallet.findUnique({
        where: { userId_currency: { userId, currency: 'USDC' } },
      });
      if (!usdcWallet) return null;
      const usdcBalance = parseFloat(usdcWallet.balance);
      if (usdcBalance <= 0.000001) return null;

      const prices = await fetchPrices();
      const rate = prices?.usdc?.ngn || FALLBACK_PRICES.usdc.ngn;
      const ngnAmount = parseFloat((usdcBalance * rate).toFixed(2));
      if (ngnAmount <= 0) return null;

      // Get or create NGN wallet inside the same transaction
      let ngnWallet = await db.wallet.findUnique({
        where: { userId_currency: { userId, currency: 'NGN' } },
      });
      if (!ngnWallet) {
        ngnWallet = await db.wallet.create({
          data: { userId, currency: 'NGN', balance: 0, lockedBalance: 0 },
        });
      }

      const reference = `OGA-CONV-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
      const newNgnBalance = parseFloat(ngnWallet.balance) + ngnAmount;

      // Atomic debit with optimistic lock -- only succeeds if balance still matches
      const result = await db.wallet.updateMany({
        where: { id: usdcWallet.id, balance: usdcBalance },
        data: { balance: 0 },
      });
      if (result.count === 0) {
        // Another concurrent call already converted or spent this balance
        logger.warn(`Auto-convert race avoided for user ${userId}: balance changed since read (was ${usdcBalance})`);
        return null;
      }

      // Credit NGN wallet
      await db.wallet.update({
        where: { id: ngnWallet.id },
        data: { balance: newNgnBalance },
      });

      // Log USDC debit transaction
      await db.transaction.create({
        data: {
          userId,
          walletId: usdcWallet.id,
          type: 'TRANSFER',
          status: 'COMPLETED',
          amount: -usdcBalance,
          currency: 'USDC',
          reference,
          balanceBefore: usdcBalance,
          balanceAfter: 0,
          description: `Auto-converted ${usdcBalance.toFixed(6)} USDC`,
          completedAt: new Date(),
          metadata: { autoConvert: true, rate, ngnAmount, fromCurrency: 'USDC', toCurrency: 'NGN' },
        },
      });

      // Log NGN credit transaction
      await db.transaction.create({
        data: {
          userId,
          walletId: ngnWallet.id,
          type: 'TRANSFER',
          status: 'COMPLETED',
          amount: ngnAmount,
          currency: 'NGN',
          reference: reference + '-NGN',
          balanceBefore: ngnWallet.balance,
          balanceAfter: newNgnBalance,
          description: `Auto-converted ${usdcBalance.toFixed(6)} USDC to ₦${ngnAmount.toLocaleString('en-NG', {minimumFractionDigits:2})} (rate: ₦${rate}/USDC)`,
          completedAt: new Date(),
          metadata: { autoConvert: true, rate, usdcAmount: usdcBalance, fromCurrency: 'USDC', toCurrency: 'NGN' },
        },
      });

      logger.info(`Auto-converted ${usdcBalance} USDC -> ₦${ngnAmount} for user ${userId} (ref: ${reference})`);
      return { reference, usdcAmount: usdcBalance, ngnAmount };
    };

    // -- 3. Execute with or without an outer transaction --
    if (options.db) {
      await executeConversion(options.db);
    } else {
      await prisma.$transaction((db) => executeConversion(db));
    }
  } catch (err) {
    // Failure must never propagate -- USDC credit already succeeded
    logger.error(`Auto-convert USDC->NGN failed for user ${userId}: ${err.message}`);
  }
};



module.exports = {
  getUserWallets,
  autoConvertUsdcToNgn,
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
  rewardSignupBonus,
};
