'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');
const vaultService = require('../services/vault.service');

const router = express.Router();

// All admin routes require auth + ADMIN role
router.use(authenticate);

const requireAdmin = async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw ApiError.forbidden('Admin access required');
  next();
};

// ── POST /vault/admin/seed-pay — Seed $PAY tokens to a user ──
router.post('/seed-pay', requireAdmin, async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !amount || amount <= 0) throw ApiError.badRequest('Valid userId and amount required');

  const balance = await vaultService.seedPayTokens(userId, amount);
  successResponse(res, { userId, amount, newPayBalance: balance }, `Seeded ${amount} $PAY tokens`);
});

// ── POST /vault/admin/distribute — Trigger manual distribution ──
router.post('/distribute', requireAdmin, async (req, res) => {
  const result = await vaultService.runDistribution();
  successResponse(res, result, result.distributed ? 'Distribution completed' : 'Distribution skipped');
});

// ── GET /vault/admin/pool — View pool stats ──
router.get('/pool', requireAdmin, async (req, res) => {
  const pool = await prisma.vaultPool.findFirst({ orderBy: { createdAt: 'desc' } });
  const revenueLog = await prisma.vaultRevenueLog.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 50,
  });
  successResponse(res, {
    pool: pool ? {
      totalNgp: Number(pool.totalNgp),
      lastDistributionAt: pool.lastDistributionAt,
      nextDistributionAt: pool.nextDistributionAt,
    } : null,
    recentRevenue: revenueLog.map(r => ({
      source: r.source,
      amountNgp: Number(r.amountNgp),
      description: r.description,
      recordedAt: r.recordedAt,
    })),
  });
});

// ── GET /vault/admin/holders — List all $PAY holders ──
router.get('/holders', requireAdmin, async (req, res) => {
  const holders = await prisma.wallet.findMany({
    where: { currency: 'PAY', balance: { gt: 0 } },
    select: {
      userId: true,
      balance: true,
      user: { select: { username: true, email: true } },
    },
    orderBy: { balance: 'desc' },
  });

  successResponse(res, holders.map(h => ({
    userId: h.userId,
    username: h.user?.username,
    email: h.user?.email,
    payBalance: Number(h.balance),
  })));
});

// ── POST /vault/admin/add-revenue — Manually add revenue to pool ──
router.post('/add-revenue', requireAdmin, async (req, res) => {
  const { amountNgp, source, description } = req.body;
  if (!amountNgp || amountNgp <= 0) throw ApiError.badRequest('Valid amountNgp required');

  await vaultService.logRevenue({
    source: source || 'other',
    amountNgp,
    description: description || 'Manual admin revenue entry',
  });

  successResponse(res, { amountNgp }, `₦${amountNgp} added to vault pool`);
});

module.exports = router;
