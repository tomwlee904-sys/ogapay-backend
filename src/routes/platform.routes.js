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

module.exports = router;
