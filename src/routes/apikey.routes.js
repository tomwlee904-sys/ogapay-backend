'use strict';
const express = require('express');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const router = express.Router();

// GET /api/v1/apikey - List user's API keys
router.get('/', authenticate, async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, permissions: true, monthlyLimit: true, rateLimit: true, usage: true, isActive: true, lastUsedAt: true, createdAt: true, revokedAt: true }
  });
  successResponse(res, keys);
});

// POST /api/v1/apikey - Create new API key
router.post('/', authenticate, async (req, res) => {
  const { name, permissions = 'full', monthlyLimit, rateLimit = 100 } = req.body;
  if (!name) throw ApiError.badRequest('Key name is required');
  const rawKey = `oga_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = rawKey.substring(0, 12);
  const key = await prisma.apiKey.create({
    data: { userId: req.user.id, name, key: rawKey, prefix, permissions, monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null, rateLimit }
  });
  createdResponse(res, { id: key.id, name: key.name, key: rawKey, prefix: key.prefix, permissions: key.permissions }, 'API key created. Save this key - it will not be shown again.');
});

// DELETE /api/v1/apikey/:id - Revoke API key
router.delete('/:id', authenticate, async (req, res) => {
  const key = await prisma.apiKey.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!key) throw ApiError.notFound('Key not found');
  await prisma.apiKey.update({ where: { id: req.params.id }, data: { isActive: false, revokedAt: new Date() } });
  successResponse(res, null, 'Key revoked');
});

// PATCH /api/v1/apikey/:id - Update API key settings
router.patch('/:id', authenticate, async (req, res) => {
  const key = await prisma.apiKey.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!key) throw ApiError.notFound('Key not found');
  const updated = await prisma.apiKey.update({ where: { id: req.params.id }, data: { monthlyLimit: req.body.monthlyLimit ? parseFloat(req.body.monthlyLimit) : undefined, rateLimit: req.body.rateLimit } });
  successResponse(res, updated, 'Key updated');
});

module.exports = router;
