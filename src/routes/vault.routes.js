'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

// ── Public: Vault overview (pool stats + next distribution) ──
router.get('/', async (req, res) => {
  const pool = await prisma.vaultPool.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const totalDistributed = await prisma.vaultDistribution.aggregate({
    _sum: { totalNgp: true, totalPay: true },
  });

  const distributionCount = await prisma.vaultDistribution.count();
  const eligibleCount = await prisma.vaultUserStats.count({
    where: { isEligible: true },
  });

  successResponse(res, {
    pool: pool ? {
      totalNgp: Number(pool.totalNgp),
      totalPay: Number(pool.totalPay),
      lastDistributionAt: pool.lastDistributionAt,
      nextDistributionAt: pool.nextDistributionAt,
    } : { totalNgp: 0, totalPay: 0, lastDistributionAt: null, nextDistributionAt: null },
    totalDistributedNgp: Number(totalDistributed._sum.totalNgp || 0),
    totalDistributedPay: Number(totalDistributed._sum.totalPay || 0),
    distributionCount,
    eligibleCount,
  });
});

// ── Auth required for user-specific vault data ──
router.use(authenticate);

// ── GET /vault/my-stats ─────────────────────────┐
router.get('/my-stats', async (req, res) => {
  const userId = req.user.id;

  // Get or create vault user stats
  let stats = await prisma.vaultUserStats.findUnique({
    where: { userId },
  });

  // Get user's $PAY wallet balance
  const payWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: 'PAY' } },
  });

  const payBalance = Number(payWallet?.balance || 0);

  // Get latest distribution for estimation
  const latestDist = await prisma.vaultDistribution.findFirst({
    orderBy: { distributedAt: 'desc' },
    include: { payouts: { where: { userId } } },
  });

  let estimatedNext = 0;
  if (latestDist && payBalance > 0) {
    const totalPayWeight = Number(latestDist.totalPayWeight);
    if (totalPayWeight > 0) {
      estimatedNext = (payBalance / totalPayWeight) * Number(latestDist.totalNgp);
    }
  }

  if (!stats) {
    stats = await prisma.vaultUserStats.create({
      data: { userId, payBalance, isEligible: payBalance > 0 },
    });
  }

  successResponse(res, {
    payBalance,
    totalEarnedNgp: Number(stats.totalEarnedNgp),
    totalEarnedPay: Number(stats.totalEarnedPay),
    distributionsReceived: stats.distributionsReceived,
    isEligible: stats.isEligible || payBalance > 0,
    estimatedNextNgp: estimatedNext,
    latestPayout: latestDist?.payouts?.[0] || null,
  });
});

// ── GET /vault/my-payouts ───────────────────────┐
router.get('/my-payouts', async (req, res) => {
  const payouts = await prisma.vaultPayout.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      distribution: {
        select: { distributedAt: true, totalNgp: true, eligibleCount: true },
      },
    },
  });

  successResponse(res, payouts.map(p => ({
    id: p.id,
    distributedAt: p.distribution.distributedAt,
    poolTotal: Number(p.distribution.totalNgp),
    eligibleCount: p.distribution.eligibleCount,
    payHolding: Number(p.payHolding),
    shareNgp: Number(p.shareNgp),
    sharePay: Number(p.sharePay),
    status: p.status,
    paidAt: p.paidAt,
  })));
});

// ── GET /vault/history ───────────────────────────┐
router.get('/history', async (req, res) => {
  const { range = '30d' } = req.query;

  let dateFrom;
  switch (range) {
    case '7d': dateFrom = new Date(Date.now() - 7 * 86400000); break;
    case '30d': dateFrom = new Date(Date.now() - 30 * 86400000); break;
    case '1y': dateFrom = new Date(Date.now() - 365 * 86400000); break;
    default: dateFrom = new Date(Date.now() - 30 * 86400000);
  }

  const distributions = await prisma.vaultDistribution.findMany({
    where: { distributedAt: { gte: dateFrom } },
    orderBy: { distributedAt: 'asc' },
    select: {
      id: true,
      totalNgp: true,
      totalPay: true,
      eligibleCount: true,
      distributedAt: true,
    },
  });

  successResponse(res, distributions.map(d => ({
    periodStart: d.distributedAt,
    amount: Number(d.totalNgp),
    payAmount: Number(d.totalPay),
    payoutCount: d.eligibleCount,
  })));
});

// ── POST /vault/eligibility ──────────────────────┐
router.post('/eligibility', async (req, res) => {
  const userId = req.user.id;

  const payWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: 'PAY' } },
  });

  const payBalance = Number(payWallet?.balance || 0);

  // User is eligible if they hold $PAY tokens
  const isEligible = payBalance > 0;

  await prisma.vaultUserStats.upsert({
    where: { userId },
    update: { payBalance, isEligible, lastActiveAt: new Date() },
    create: { userId, payBalance, isEligible, lastActiveAt: new Date() },
  });

  successResponse(res, { isEligible, payBalance });
});

module.exports = router;

// ── GET /vault/pending-payouts ──────────────────┐
router.get('/pending-payouts', async (req, res) => {
  const payouts = await prisma.vaultPayout.findMany({
    where: { userId: req.user.id, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      distribution: {
        select: { distributedAt: true, totalNgp: true },
      },
    },
  });

  successResponse(res, payouts.map(p => ({
    id: p.id,
    distributedAt: p.distribution.distributedAt,
    shareNgp: Number(p.shareNgp),
    payHolding: Number(p.payHolding),
    status: p.status,
  })));
});

// ── POST /vault/claim ───────────────────────────┐
router.post('/claim', async (req, res) => {
  const vaultService = require('../services/vault.service');
  const userId = req.user.id;

  // Get all pending payouts
  const pendingPayouts = await prisma.vaultPayout.findMany({
    where: { userId, status: 'pending' },
  });

  if (pendingPayouts.length === 0) {
    return successResponse(res, { claimed: 0, totalNgp: 0 }, 'No pending payouts to claim');
  }

  let totalClaimed = 0;
  for (const payout of pendingPayouts) {
    // Credit to user's NGN wallet
    await vaultService.creditPayoutToWallet(userId, Number(payout.shareNgp));

    // Mark as paid
    await prisma.vaultPayout.update({
      where: { id: payout.id },
      data: { status: 'paid', paidAt: new Date() },
    });

    totalClaimed += Number(payout.shareNgp);
  }

  successResponse(res, {
    claimed: pendingPayouts.length,
    totalNgp: totalClaimed,
  }, `Claimed ₦${totalClaimed.toLocaleString()} from ${pendingPayouts.length} payout(s)`);
});
