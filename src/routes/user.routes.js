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

// POST /api/v1/users/wallet — Save wallet connection (for non-Solana wallets)
router.post('/wallet', authenticate, async (req, res) => {
  const { walletAddress, provider } = req.body;
  if (!walletAddress) {
    throw require('../utils/apiResponse').ApiError.badRequest('Wallet address required');
  }
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { walletAddress, walletProvider: provider || 'phantom', walletConnectedAt: new Date() },
  });
  res.json({ success: true, walletAddress: updated.walletAddress });
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

// GET /api/v1/users/public/:username/blogs
router.get('/public/:username/blogs', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: req.params.username } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const posts = await prisma.blogPost.findMany({
    where: { authorId: user.id, isPublished: true },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, excerpt: true, slug: true, coverImage: true, tags: true, publishedAt: true, createdAt: true },
  });
  successResponse(res, posts);
});


// GET /api/v1/users/public/:username/communities
router.get('/public/:username/communities', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: req.params.username } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const memberships = await prisma.communityMember.findMany({
    where: { userId: user.id },
    include: {
      community: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  successResponse(res, memberships.map(m => ({
    id: m.community.id,
    slug: m.community.slug,
    name: m.community.name,
    description: m.community.description,
    coverImage: m.community.coverImage,
    accentColor: m.community.accentColor,
    memberCount: m.community._count.members,
    role: m.role,
    owner: { username: user.username },
    initials: (m.community.name || '?').split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
  })));
});

// GET /api/v1/users/:username
router.get("/:username", async (req, res) => {
  const data = await userService.getPublicProfile(req.params.username);
  successResponse(res, data, 'Profile fetched');
});

// GET /api/v1/users/me/earnings
router.get('/me/earnings', authenticate, async (req, res) => {
  const result = await userService.getEarnings(req.user.id);
  successResponse(res, result, 'Earnings fetched');
});

// PATCH /api/v1/users/me/preferences
router.patch('/me/preferences', authenticate, async (req, res) => {
  const { preferences } = req.body;
  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({ success: false, message: 'preferences object required' });
  }
  const user = await userService.updateProfile(req.user.id, { preferences });
  successResponse(res, { preferences: user.preferences }, 'Preferences updated');
});

// DELETE /api/v1/users/me
router.delete('/me', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const { successResponse } = require('../utils/apiResponse');
  await prisma.user.update({
    where: { id: req.user.id },
    data: { isBanned: true, email: 'deleted_' + req.user.id + '@ogapay.com' },
  });
  successResponse(res, null, 'Account deleted successfully');
});

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

module.exports = router;

// ── Bookmark routes ──────────────────────────────────────────
// GET /users/bookmarks — fetch all bookmarks
router.get('/bookmarks', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: req.user.id },
    include: {
      task: {
        select: {
          id: true, title: true, description: true,
          reward: true, currency: true, category: true, status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, bookmarks });
});

// POST /users/bookmarks/:taskId — add bookmark
router.post('/bookmarks/:taskId', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const existing = await prisma.bookmark.findUnique({
    where: { userId_taskId: { userId: req.user.id, taskId: req.params.taskId } }
  });
  if (existing) return res.json({ success: true, bookmarked: true });

  await prisma.bookmark.create({
    data: { userId: req.user.id, taskId: req.params.taskId }
  });
  res.json({ success: true, bookmarked: true });
});

// DELETE /users/bookmarks/:taskId — remove bookmark
router.delete('/bookmarks/:taskId', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  await prisma.bookmark.deleteMany({
    where: { userId: req.user.id, taskId: req.params.taskId }
  });
  res.json({ success: true, bookmarked: false });
});
