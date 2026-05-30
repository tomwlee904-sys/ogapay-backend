'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/summary', authenticate, async (req, res) => {
  const userId = req.user.id;
  const [wallets, postedTasks, submissions, unreadNotifications] = await Promise.all([
    prisma.wallet.findMany({ where: { userId, isActive: true } }),
    prisma.task.count({ where: { posterId: userId } }),
    prisma.taskSubmission.count({ where: { workerId: userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  successResponse(res, {
    wallets,
    metrics: {
      postedTasks,
      submissions,
      unreadNotifications,
    },
  }, 'Dashboard summary fetched');
});

module.exports = router;
