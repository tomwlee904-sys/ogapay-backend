'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();

// GET / — Root leaderboard (delegates to workers)
router.get('/', async (req, res) => {
  const workers = await prisma.workerProfile.findMany({
    where: { tasksCompleted: { gt: 0 } },
    select: {
      user: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
      tasksCompleted: true,
      totalEarned: true,
    },
    orderBy: { totalEarned: 'desc' },
    take: 20,
  });
  const mapped = workers.map((w, i) => ({
    rank: i + 1,
    name: (w.user?.firstName || '') + ' ' + (w.user?.lastName || ''),
    username: w.user?.username,
    avatarUrl: w.user?.avatarUrl,
    earnings: Number(w.totalEarned || 0),
    tasks: w.tasksCompleted || 0,
  }));
  successResponse(res, { topEarners: mapped, period: 'all_time' });
});


// GET /api/v1/leaderboard/workers
// Rank workers by: earnings | tasks_completed | reputation
router.get('/workers', async (req, res) => {
  const { page = 1, limit = 20, period = 'all', sortBy = 'reputationScore' } = req.query;
  const skip = (page - 1) * limit;

  const validSort = ['reputationScore', 'totalEarned', 'tasksCompleted', 'avgRating'];
  const orderField = validSort.includes(sortBy) ? sortBy : 'reputationScore';

  const [workers, total] = await Promise.all([
    prisma.workerProfile.findMany({
      skip,
      take: parseInt(limit),
      orderBy: { [orderField]: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, avatarUrl: true, createdAt: true },
        },
      },
    }),
    prisma.workerProfile.count(),
  ]);

  // Add rank numbers
  const ranked = workers.map((w, idx) => ({
    rank: skip + idx + 1,
    ...w,
  }));

  paginatedResponse(res, ranked, paginate(page, limit, total), 'Leaderboard fetched');
});

// GET /api/v1/leaderboard/me — Get user's rank
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { verifyAccessToken } = require('../utils/jwt');
  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);

  const myProfile = await prisma.workerProfile.findUnique({
    where: { userId: decoded.sub },
  });

  if (!myProfile) {
    return successResponse(res, { rank: null }, 'No worker profile found');
  }

  // Count workers with higher reputation
  const rank = await prisma.workerProfile.count({
    where: { reputationScore: { gt: myProfile.reputationScore } },
  }) + 1;

  successResponse(res, { rank, profile: myProfile }, 'Your rank fetched');
});

// GET /api/v1/leaderboard/top-earners — Weekly top earners
router.get('/top-earners', async (req, res) => {
  const { limit = 10 } = req.query;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const topEarners = await prisma.transaction.groupBy({
    by: ['userId'],
    where: {
      type: 'TASK_PAYMENT',
      status: 'COMPLETED',
      createdAt: { gte: weekAgo },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: parseInt(limit),
  });

  // Attach user info
  const withUsers = await Promise.all(
    topEarners.map(async (e) => {
      const user = await prisma.user.findUnique({
        where: { id: e.userId },
        select: {
          id: true,
          username: true,
          firstName: true,
          avatarUrl: true,
          workerProfile: { select: { level: true } },
        },
      });
      return { ...user, weeklyEarnings: e._sum.amount };
    }),
  );

  successResponse(res, withUsers, 'Top earners fetched');
});

module.exports = router;
