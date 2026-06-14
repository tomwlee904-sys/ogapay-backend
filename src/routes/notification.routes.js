'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/notifications
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const skip = (page - 1) * limit;
  const where = {
    userId: req.user.id,
    ...(unreadOnly === 'true' && { isRead: false }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ]);

  paginatedResponse(res, { notifications, unreadCount }, paginate(page, limit, total));
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { isRead: true },
  });
  successResponse(res, null, 'Notification marked as read');
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  successResponse(res, { updated: count }, `${count} notifications marked as read`);
});

// DELETE /api/v1/notifications/:id
router.delete('/:id', async (req, res) => {
  await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: req.user.id },
  });
  successResponse(res, null, 'Notification deleted');
});

module.exports = router;
