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

// ── Public: Lookup vault eligibility by Solana wallet address ──
router.get('/lookup', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) {
    return successResponse(res, null, 'Solana wallet address required');
  }

  // Find user by their connected Solana wallet address
  const user = await prisma.user.findFirst({
    where: { walletAddress: wallet },
    select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, walletAddress: true },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'Wallet not found on OgaPay' });
  }

  // Get vault stats
  const stats = await prisma.vaultUserStats.findUnique({
    where: { userId: user.id },
  });

  // Get $PAY balance
  const payWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: user.id, currency: 'PAY' } },
  });

  const payBalance = Number(payWallet?.balance || 0);
  const totalEarned = Number(stats?.totalEarnedNgp || 0);
  const distributionsReceived = stats?.distributionsReceived || 0;
  const isEligible = payBalance > 0;

  successResponse(res, {
    wallet: user.walletAddress,
    user: {
      username: user.username,
      name: `${user.firstName} ${user.lastName}`,
      avatarUrl: user.avatarUrl,
    },
    vault: {
      payBalance,
      totalEarned,
      distributionsReceived,
      isEligible,
    },
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

  // Check if user has a connected Solana wallet
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletAddress: true },
  });

  if (!user?.walletAddress) {
    return successResponse(res, { claimed: 0, totalNgp: 0, needsWallet: true }, 'Connect your Solana wallet first to claim payouts');
  }

  // Get all pending payouts
  const pendingPayouts = await prisma.vaultPayout.findMany({
    where: { userId, status: 'pending' },
  });

  if (pendingPayouts.length === 0) {
    return successResponse(res, { claimed: 0, totalNgp: 0 }, 'No pending payouts to claim');
  }

  let totalClaimed = 0;
  for (const payout of pendingPayouts) {
    // Send to Solana wallet via USDC transfer (handled by external service/hook)
    await vaultService.creditPayoutToSolana(userId, user.walletAddress, Number(payout.shareNgp));

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
    walletAddress: user.walletAddress,
  }, `Claimed $${totalClaimed.toLocaleString()} to your Solana wallet from ${pendingPayouts.length} payout(s)`);
});

// ── GET /vault/history/batches — Paginated batch list ──
router.get('/history/batches', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 10;
  const skip = (page - 1) * limit;

  const [batches, total] = await Promise.all([
    prisma.vaultDistribution.findMany({
      orderBy: { distributedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        totalNgp: true,
        totalPay: true,
        eligibleCount: true,
        distributedAt: true,
        _count: { select: { payouts: true } },
      },
    }),
    prisma.vaultDistribution.count(),
  ]);

  successResponse(res, {
    batches: batches.map(b => ({
      id: b.id,
      batchNumber: b.distributedAt ? Math.floor(new Date(b.distributedAt).getTime() / 1000) % 100000 : 0,
      distributedAt: b.distributedAt,
      totalPay: Number(b.totalPay || b.totalNgp || 0),
      status: 'COMPLETED',
      payoutCount: b._count?.payouts || 0,
    })),
    page,
    totalPages: Math.ceil(total / limit),
    totalBatches: total,
  });
});

// ── GET /vault/history/batches/:batchId — Per-wallet breakdown for a batch ──
router.get('/history/batches/:batchId', async (req, res) => {
  const { batchId } = req.params;

  const payouts = await prisma.vaultPayout.findMany({
    where: { distributionId: batchId },
    orderBy: { shareNgp: 'desc' },
    take: 50,
    select: {
      userId: true,
      payHolding: true,
      shareNgp: true,
      status: true,
      user: { select: { walletAddress: true, username: true } },
    },
  });

  const totalWeight = payouts.reduce((s, p) => s + Number(p.payHolding), 0);

  successResponse(res, {
    wallets: payouts.map(p => ({
      wallet: p.user?.walletAddress || `user_${p.userId?.slice(0, 8)}`,
      username: p.user?.username || null,
      amount: Number(p.shareNgp),
      vaultSharePct: totalWeight > 0 ? (Number(p.payHolding) / totalWeight) * 100 : 0,
      status: p.status,
    })),
    batchId,
  });
});

// ── GET /vault/lookup/rewards — Wallet rewards history ──
router.get('/lookup/rewards', async (req, res) => {
  const { wallet, range = '7d' } = req.query;
  if (!wallet) {
    return successResponse(res, null, 'Wallet address required');
  }

  const user = await prisma.user.findFirst({
    where: { walletAddress: wallet },
    select: { id: true },
  });

  if (!user) {
    return successResponse(res, {
      totalReceivedPay: 0,
      completedDistributions: 0,
      otherEntries: 0,
      receivedInPeriodPay: 0,
      currentUsdEstimate: 0,
      chartData: [],
    });
  }

  let dateFrom;
  switch (range) {
    case '7d': dateFrom = new Date(Date.now() - 7 * 86400000); break;
    case '30d': dateFrom = new Date(Date.now() - 30 * 86400000); break;
    case '1y': dateFrom = new Date(Date.now() - 365 * 86400000); break;
    default: dateFrom = new Date(Date.now() - 7 * 86400000);
  }

  // Get all paid payouts for this user
  const allPayouts = await prisma.vaultPayout.findMany({
    where: { userId: user.id, status: 'paid' },
    orderBy: { paidAt: 'desc' },
    include: { distribution: { select: { distributedAt: true } } },
  });

  const completedDistributions = allPayouts.length;
  const totalReceivedPay = allPayouts.reduce((s, p) => s + Number(p.shareNgp || p.sharePay || 0), 0);

  // Payouts within the selected time range
  const periodPayouts = allPayouts.filter(p => {
    const d = p.paidAt || p.updatedAt || p.distribution?.distributedAt;
    return d && new Date(d) >= dateFrom;
  });

  const receivedInPeriodPay = periodPayouts.reduce((s, p) => s + Number(p.shareNgp || p.sharePay || 0), 0);

  // Chart data grouped by day
  const chartMap = new Map();
  for (const p of periodPayouts) {
    const d = p.paidAt || p.updatedAt || p.distribution?.distributedAt;
    if (!d) continue;
    const day = new Date(d).toISOString().slice(0, 10);
    chartMap.set(day, (chartMap.get(day) || 0) + Number(p.shareNgp || p.sharePay || 0));
  }
  const chartData = Array.from(chartMap.entries())
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  successResponse(res, {
    totalReceivedPay: Math.round(totalReceivedPay * 100) / 100,
    completedDistributions,
    otherEntries: 0,
    receivedInPeriodPay: Math.round(receivedInPeriodPay * 100) / 100,
    currentUsdEstimate: 0,
    chartData,
  });
});
