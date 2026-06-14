'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/', async (req, res) => {
  const [
    totalPaidResult,
    activeWorkersResult,
    tasksDone,
    openTasks,
    totalUsers,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'TASK_PAYMENT', status: 'COMPLETED' },
    }),
    prisma.taskSubmission.groupBy({
      by: ['workerId'],
      where: { status: 'APPROVED' },
      _count: { id: true },
    }),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.task.count({ where: { status: 'OPEN' } }),
    prisma.user.count(),
  ]);

  successResponse(res, {
    totalPaid: totalPaidResult._sum.amount || 0,
    activeWorkers: activeWorkersResult.length,
    tasksDone,
    openTasks,
    totalUsers,
  }, 'Platform stats fetched');
});

// ── Live Stats (cached, refreshes every 60s) ──
let statsCache = null;
let lastFetched = 0;

router.get('/live', async (req, res) => {
  const now = Date.now();
  if (statsCache && now - lastFetched < 60000) {
    return res.json(statsCache);
  }

  const [
    activeJobs,
    totalPaidResult,
    activeWorkers,
    tasksDone,
    last24hPaidResult,
    last24hTasks,
  ] = await Promise.all([
    prisma.task.count({ where: { status: 'OPEN' } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'TASK_PAYMENT', status: 'COMPLETED' },
    }),
    prisma.workerProfile.count({ where: { tasksCompleted: { gt: 0 } } }),
    prisma.taskSubmission.count({ where: { status: 'APPROVED' } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'TASK_PAYMENT',
        status: 'COMPLETED',
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    }),
    prisma.taskSubmission.count({
      where: {
        status: 'APPROVED',
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    }),
  ]);

  statsCache = {
    activeJobs,
    totalPaidOut: Number(totalPaidResult._sum.amount) || 0,
    activeWorkers,
    tasksDone,
    last24hPaid: Number(last24hPaidResult._sum.amount) || 0,
    last24hTasks,
  };
  lastFetched = now;
  res.json(statsCache);
});

module.exports = router;
