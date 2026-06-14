'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/summary', authenticate, async (req, res) => {
  const userId = req.user.id;

  const [wallets, postedTasks, submissions, unreadNotifications, activePostedTasks, completedPostedTasks, approvedSubmissions, posterProfile, workerProfile, userWallet, userTwitter] = await Promise.all([
    prisma.wallet.findMany({ where: { userId, isActive: true } }),
    prisma.task.count({ where: { posterId: userId } }),
    prisma.taskSubmission.count({ where: { workerId: userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.task.count({ where: { posterId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { posterId: userId, status: 'COMPLETED' } }),
    prisma.taskSubmission.count({ where: { workerId: userId, status: 'APPROVED' } }),
    prisma.posterProfile.findUnique({ where: { userId }, select: { totalSpent: true } }),
    prisma.workerProfile.findUnique({ where: { userId }, select: { totalEarned: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { walletAddress: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { twitterId: true } }),
  ]);

  successResponse(res, {
    wallets,
    metrics: {
      postedTasks,
      submissions,
      activeTasks: activePostedTasks + (submissions - approvedSubmissions),
      completedTasks: completedPostedTasks + approvedSubmissions,
      totalSpent: Number(posterProfile?.totalSpent || 0) + Number(workerProfile?.totalEarned || 0),
      walletConnected: wallets.some(w => w.currency === 'SOL' && w.walletAddress) || !!userWallet?.walletAddress,
      twitterConnected: !!userTwitter?.twitterId,
      unreadNotifications,
    },
  }, 'Dashboard summary fetched');
});

module.exports = router;
