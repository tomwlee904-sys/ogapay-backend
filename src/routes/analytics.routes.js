'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');

const router = express.Router();

// GET /api/v1/analytics — User analytics overview
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;

  const [workerProfile, tasks, submissions, recentSubmissions] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId } }),
    prisma.task.findMany({ where: { posterId: userId } }),
    prisma.taskSubmission.findMany({ where: { workerId: userId }, include: { task: true } }),
    prisma.taskSubmission.findMany({
      where: { workerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { task: { select: { title: true, reward: true, currency: true } } },
    }),
  ]);

  const completedSubs = submissions.filter(s => s.status === 'APPROVED');
  const totalEarnings = completedSubs.reduce((s, sub) => s + Number(sub.task?.reward || 0), 0);
  const successRate = submissions.length > 0 ? completedSubs.length / submissions.length : 0;
  const avgRating = workerProfile?.avgRating || 0;

  // Build weekly and monthly data
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const weeklySubs = submissions.filter(s => new Date(s.createdAt) >= weekAgo);
  const monthlySubs = submissions.filter(s => new Date(s.createdAt) >= monthAgo);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = dayNames[d.getDay()];
    weeklyMap[key] = { day: key, tasks: 0, earnings: 0 };
  }
  weeklySubs.forEach(s => {
    const key = dayNames[new Date(s.createdAt).getDay()];
    if (weeklyMap[key]) {
      weeklyMap[key].tasks++;
      weeklyMap[key].earnings += Number(s.task?.reward || 0);
    }
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthNames[d.getMonth()];
    monthlyMap[key] = { month: key, tasks: 0, earnings: 0 };
  }
  monthlySubs.forEach(s => {
    const key = monthNames[new Date(s.createdAt).getMonth()];
    if (monthlyMap[key]) {
      monthlyMap[key].tasks++;
      monthlyMap[key].earnings += Number(s.task?.reward || 0);
    }
  });

  const recentActivity = recentSubmissions.map(s => ({
    period: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    task: s.task?.title || 'Unknown',
    status: s.status,
    earnings: Number(s.task?.reward || 0),
    currency: s.task?.currency || 'NGN',
  }));

  successResponse(res, {
    stats: {
      tasksCompleted: submissions.length,
      totalEarnings,
      successRate: Math.round(successRate * 100),
      avgRating: Math.round(avgRating * 10) / 10,
    },
    weekly: Object.values(weeklyMap),
    monthly: Object.values(monthlyMap),
    recentActivity,
  });
});

module.exports = router;
