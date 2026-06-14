'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { type } = req.query;
  const where = { userId: req.user.id, ...(type && { type }) };
  const bookmarks = await prisma.bookmark.findMany({ where, orderBy: { createdAt: 'desc' } });
  successResponse(res, bookmarks);
});

router.post('/', authenticate, async (req, res) => {
  const { type, targetId, metadata } = req.body;
  if (!type || !targetId) throw ApiError.badRequest('Type and targetId are required');
  const existing = await prisma.bookmark.findUnique({ where: { userId_type_targetId: { userId: req.user.id, type, targetId } } });
  if (existing) throw ApiError.badRequest('Already bookmarked');
  const bookmark = await prisma.bookmark.create({ data: { userId: req.user.id, type, targetId, metadata } });
  createdResponse(res, bookmark, 'Bookmarked');
});

router.delete('/:id', authenticate, async (req, res) => {
  const bookmark = await prisma.bookmark.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!bookmark) throw ApiError.notFound('Bookmark not found');
  await prisma.bookmark.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Removed from bookmarks');
});

module.exports = router;
