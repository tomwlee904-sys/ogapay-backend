'use strict';

const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');

// ── Log platform revenue into the vault pool ──
const logRevenue = async ({ source, sourceId, amountNgp, description }) => {
  try {
    // Create revenue log entry
    await prisma.vaultRevenueLog.create({
      data: {
        source,
        sourceId,
        amountNgp,
        description: description || `Revenue from ${source}`,
      },
    });

    // Add to vault pool (upsert — only one pool row)
    const pool = await prisma.vaultPool.findFirst({ orderBy: { createdAt: 'desc' } });
    if (pool) {
      await prisma.vaultPool.update({
        where: { id: pool.id },
        data: { totalNgp: { increment: amountNgp } },
      });
    } else {
      await prisma.vaultPool.create({
        data: { totalNgp: amountNgp },
      });
    }

    logger.info(`Revenue logged: ${source} — ₦${amountNgp}`);
  } catch (err) {
    logger.error(`Failed to log revenue: ${err.message}`);
  }
};

// ── Get user's $PAY balance ─────────────────────
const getUserPayBalance = async (userId) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: 'PAY' } },
  });
  return Number(wallet?.balance || 0);
};

// ── Ensure user has a PAY wallet ────────────────
const ensurePayWallet = async (userId) => {
  let wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: 'PAY' } },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, currency: 'PAY', balance: 0, lockedBalance: 0, isActive: true },
    });
  }
  return wallet;
};

// ── Seed $PAY tokens to a user (admin only) ────
const seedPayTokens = async (userId, amount) => {
  await ensurePayWallet(userId);

  const wallet = await prisma.wallet.update({
    where: { userId_currency: { userId, currency: 'PAY' } },
    data: { balance: { increment: amount } },
  });

  // Update vault user stats
  await prisma.vaultUserStats.upsert({
    where: { userId },
    update: { payBalance: Number(wallet.balance), isEligible: Number(wallet.balance) > 0 },
    create: { userId, payBalance: Number(wallet.balance), isEligible: Number(wallet.balance) > 0 },
  });

  logger.info(`Seeded ${amount} $PAY to user ${userId}`);
  return Number(wallet.balance);
};

// ── Run distribution ────────────────────────────
const runDistribution = async () => {
  const pool = await prisma.vaultPool.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!pool || Number(pool.totalNgp) <= 0) {
    logger.info('Vault distribution skipped — pool is empty');
    return { skipped: true, reason: 'Pool empty' };
  }

  const poolTotal = Number(pool.totalNgp);

  // Find all eligible users (hold $PAY > 0)
  const eligible = await prisma.wallet.findMany({
    where: { currency: 'PAY', balance: { gt: 0 }, isActive: true },
    select: { userId: true, balance: true },
  });

  if (eligible.length === 0) {
    logger.info('Vault distribution skipped — no eligible $PAY holders');
    return { skipped: true, reason: 'No eligible holders' };
  }

  // Calculate total weight (sum of all $PAY balances)
  const totalPayWeight = eligible.reduce((sum, u) => sum + Number(u.balance), 0);

  // Schedule next distribution (24 hours from now)
  const nextDistAt = new Date(Date.now() + 86400000);

  // Create distribution record
  const distribution = await prisma.vaultDistribution.create({
    data: {
      poolId: pool.id,
      totalNgp: poolTotal,
      totalPayWeight,
      eligibleCount: eligible.length,
    },
  });

  // Calculate and create payouts for each eligible user
  const payouts = [];
  for (const holder of eligible) {
    const userWeight = Number(holder.balance);
    const shareNgp = (userWeight / totalPayWeight) * poolTotal;

    if (shareNgp < 1) continue; // Skip dust (< ₦1)

    payouts.push({
      distributionId: distribution.id,
      userId: holder.userId,
      payHolding: userWeight,
      payWeight: userWeight / totalPayWeight,
      shareNgp,
      sharePay: 0,
      status: 'pending',
    });
  }

  if (payouts.length > 0) {
    await prisma.vaultPayout.createMany({ data: payouts });

    // Update user stats
    for (const payout of payouts) {
      await prisma.vaultUserStats.upsert({
        where: { userId: payout.userId },
        update: {
          totalEarnedNgp: { increment: payout.shareNgp },
          distributionsReceived: { increment: 1 },
          isEligible: true,
          lastActiveAt: new Date(),
        },
        create: {
          userId: payout.userId,
          totalEarnedNgp: payout.shareNgp,
          distributionsReceived: 1,
          payBalance: payout.payHolding,
          isEligible: true,
          lastActiveAt: new Date(),
        },
      });
    }
  }

  // Reset pool
  await prisma.vaultPool.update({
    where: { id: pool.id },
    data: {
      totalNgp: 0,
      lastDistributionAt: new Date(),
      nextDistributionAt: nextDistAt,
    },
  });

  logger.info(`Vault distribution completed: ₦${poolTotal} distributed to ${payouts.length} holders`);

  return {
    distributed: true,
    totalNgp: poolTotal,
    recipients: payouts.length,
    totalPayWeight,
    nextDistributionAt: nextDistAt,
  };
};

// ── Credit user's wallet with $PAY earnings ─────
const creditPayoutToWallet = async (userId, amountNgp) => {
  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId, currency: 'NGN' } },
    update: { balance: { increment: amountNgp } },
    create: { userId, currency: 'NGN', balance: amountNgp, lockedBalance: 0, isActive: true },
  });

  const reference = `OGA-VAULT-${require('uuid').v4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

  await prisma.transaction.create({
    data: {
      userId,
      walletId: wallet.id,
      type: 'TASK_REWARD',
      status: 'COMPLETED',
      amount: amountNgp,
      currency: 'NGN',
      reference,
      balanceBefore: Number(wallet.balance) - amountNgp,
      balanceAfter: Number(wallet.balance),
      description: 'Vault distribution payout',
    },
  });
};

module.exports = {
  logRevenue,
  getUserPayBalance,
  ensurePayWallet,
  seedPayTokens,
  runDistribution,
  creditPayoutToWallet,
};
