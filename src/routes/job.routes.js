'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

// GET /api/v1/jobs/monitor — Poster's job monitor with summary
router.get('/monitor', authenticate, authorize('POSTER', 'ADMIN'), async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { posterId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { submissions: true } },
      submissions: {
        select: { status: true },
      },
    },
  });

  const summary = {
    totalJobs: tasks.length,
    activeJobs: tasks.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
    totalBudgetSpent: tasks.reduce((sum, t) => sum + Number(t.reward) * (t.currentWorkers || 0), 0),
    totalSubmissions: tasks.reduce((sum, t) => sum + t._count.submissions, 0),
    pendingReview: tasks.reduce((sum, t) => sum + t.submissions.filter(s => s.status === 'SUBMITTED').length, 0),
  };

  const jobs = tasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    reward: Number(t.reward),
    currency: t.currency,
    maxWorkers: t.maxWorkers,
    currentWorkers: t.currentWorkers || 0,
    submissionsCount: t._count.submissions,
    approvedCount: t.submissions.filter(s => s.status === 'APPROVED').length,
    pendingCount: t.submissions.filter(s => s.status === 'SUBMITTED').length,
    rejectedCount: t.submissions.filter(s => s.status === 'REJECTED').length,
    budgetSpent: Number(t.reward) * (t.currentWorkers || 0),
    budgetRemaining: Number(t.reward) * (t.maxWorkers - (t.currentWorkers || 0)),
    deadline: t.deadline,
    createdAt: t.createdAt,
  }));

  successResponse(res, { summary, jobs });
});

module.exports = router;