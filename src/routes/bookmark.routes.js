'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const router = express.Router();

// Saved jobs. The Bookmark model is keyed by (userId, taskId); this route used
// fields the model doesn't have (targetId), so every call failed. The app uses
// /users/bookmarks; these stay for older clients.

router.get('/', authenticate, async (req, res) => {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user.id },
    include: { task: { select: { id: true, title: true, description: true, reward: true, currency: true, category: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  successResponse(res, bookmarks);
});

router.post('/', authenticate, async (req, res) => {
  const taskId = String(req.body.taskId || req.body.targetId || '');
  if (!taskId) throw ApiError.badRequest('taskId is required');
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) throw ApiError.notFound('Task not found');
  const bookmark = await prisma.bookmark.upsert({
    where: { userId_taskId: { userId: req.user.id, taskId } },
    update: {},
    create: { userId: req.user.id, taskId },
  });
  createdResponse(res, bookmark, 'Bookmarked');
});

// :id may be the bookmark id or the task id
router.delete('/:id', authenticate, async (req, res) => {
  const { count } = await prisma.bookmark.deleteMany({
    where: { userId: req.user.id, OR: [{ id: req.params.id }, { taskId: req.params.id }] },
  });
  if (!count) throw ApiError.notFound('Bookmark not found');
  successResponse(res, null, 'Removed from bookmarks');
});

module.exports = router;
