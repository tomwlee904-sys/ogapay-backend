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
  // Everyone holding $PAY right now shares the next distribution
  const holders = await prisma.wallet.aggregate({
    where: { currency: 'PAY', balance: { gt: 0 }, isActive: true },
    _sum: { balance: true },
    _count: { _all: true },
  });
  const eligibleCount = holders._count._all;
  // Runs at 00:00 and 12:00 UTC
  const now = new Date();
  const nextRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() < 12 ? 12 : 24));

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
    paySupply: Number(holders._sum.balance || 0),
    nextRunAt: nextRun,
  });
});

// ── Public: recent money into the vault (platform fees) ──
const SOURCE_LABEL = { task_fee: 'Job fee', task_fee_refund: 'Fee refunded', store_commission: 'Store fee', service_cut: 'Service fee' };
router.get('/contributions', async (req, res) => {
  const logs = await prisma.vaultRevenueLog.findMany({
    orderBy: { recordedAt: 'desc' },
    take: Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20)),
    select: { id: true, source: true, sourceId: true, amountNgp: true, recordedAt: true },
  });
  successResponse(res, logs.map((l) => ({
    id: l.id,
    at: l.recordedAt,
    amountNgp: Number(l.amountNgp),
    reason: SOURCE_LABEL[l.source] || 'Other',
    ref: l.sourceId ? '#' + String(l.sourceId).slice(0, 8) : null,
  })));
});

// ── Public: last 30 days, per UTC day (what came in, what was shared) ──
router.get('/trend', async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const [dists, logs] = await Promise.all([
    prisma.vaultDistribution.findMany({ where: { distributedAt: { gte: since } }, select: { distributedAt: true, totalNgp: true } }),
    prisma.vaultRevenueLog.findMany({ where: { recordedAt: { gte: since } }, select: { recordedAt: true, amountNgp: true } }),
  ]);
  const days = {};
  for (let d = 29; d >= 0; d--) days[new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)] = { distributedNgp: 0, revenueNgp: 0 };
  for (const x of dists) { const k = new Date(x.distributedAt).toISOString().slice(0, 10); if (days[k]) days[k].distributedNgp += Number(x.totalNgp); }
  for (const x of logs) { const k = new Date(x.recordedAt).toISOString().slice(0, 10); if (days[k]) days[k].revenueNgp += Number(x.amountNgp); }
  successResponse(res, Object.entries(days).map(([day, v]) => ({ day, distributedNgp: Math.round(v.distributedNgp * 100) / 100, revenueNgp: Math.round(v.revenueNgp * 100) / 100 })));
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

  // Public endpoint: never reveal who owns a wallet (name/username/avatar)
  successResponse(res, {
    wallet: user.walletAddress,
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
  const result = await vaultService.claimPendingPayouts(req.user.id);
  if (!result.claimed) return successResponse(res, result, 'No pending payouts to claim');
  successResponse(res, result, `Claimed ₦${result.totalNgp.toLocaleString('en-US')} to your wallet`);
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
