'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const userService = require('../services/user.service');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');
const { prisma } = require('../config/database');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/v1/users/me - current frontend alias
router.get('/me', authenticate, async (req, res) => {
  const data = await userService.getProfile(req.user.id);
  successResponse(res, data, 'Profile fetched');
});

// PATCH /api/v1/users/me - current frontend alias
router.patch('/me', authenticate, async (req, res) => {
  const data = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, data, 'Profile updated');
});

// GET /api/v1/users/profile
router.get('/profile', authenticate, async (req, res) => {
  const data = await userService.getProfile(req.user.id);
  successResponse(res, data, 'Profile fetched');
});

// PATCH /api/v1/users/profile
router.patch('/profile', authenticate, async (req, res) => {
  const data = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, data, 'Profile updated');
});

// POST /api/v1/users/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  if (!req.file) throw require('../utils/apiResponse').ApiError.badRequest('No file uploaded');
  const data = await userService.uploadAvatar(req.user.id, req.file);
  successResponse(res, data, 'Avatar updated');
});

// GET /api/v1/users/transactions/history
router.get('/transactions/history', authenticate, async (req, res) => {
  const { page = 1, limit = 20, type, currency } = req.query;
  const { transactions, total } = await userService.getTransactionHistory(
    req.user.id, { page, limit, type, currency }
  );
  paginatedResponse(res, transactions, paginate(page, limit, total));
});

// GET /api/v1/users/referrals/stats
router.get('/referrals/stats', authenticate, async (req, res) => {
  const data = await userService.getReferralStats(req.user.id);
  successResponse(res, data, 'Referral stats fetched');
});

// GET /api/v1/users/directory/list
router.get('/directory/list', async (req, res) => {
  const { search, role, sort, page = 1, limit = 24 } = req.query;
  const skip = (page - 1) * limit;
  
  const where = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        workerProfile: {
          select: { level: true, reputationScore: true, tasksCompleted: true, bio: true, isAvailable: true },
        },
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  paginatedResponse(res, users, paginate(page, limit, total));
});

// GET /api/v1/users/:username
router.get("/:username", async (req, res) => {
  const data = await userService.getWorkerPublicProfile(req.params.username);
  successResponse(res, data, 'Profile fetched');
});


// GET /api/v1/users/me/earnings
router.get('/me/earnings', authenticate, async (req, res) => {
  const result = await userService.getEarnings(req.user.id);
  successResponse(res, result, 'Earnings fetched');
});

module.exports = router;

// GET /api/v1/users/search — Simple user search for messaging (returns flat array)
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
    take: 10,
  });

  successResponse(res, users);
});
