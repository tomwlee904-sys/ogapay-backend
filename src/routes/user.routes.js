'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate, hireSchema, portfolioItemSchema, updateProfileSchema } = require('../middleware/validate');
const taskService = require('../services/task.service');
const { ApiError } = require('../utils/apiResponse');
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
router.patch('/me', authenticate, validate(updateProfileSchema), async (req, res) => {
  const data = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, data, 'Profile updated');
});

// GET /api/v1/users/profile
router.get('/profile', authenticate, async (req, res) => {
  const data = await userService.getProfile(req.user.id);
  successResponse(res, data, 'Profile fetched');
});

// PATCH /api/v1/users/profile
router.patch('/profile', authenticate, validate(updateProfileSchema), async (req, res) => {
  const data = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, data, 'Profile updated');
});

// POST /api/v1/users/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  if (!req.file) throw require('../utils/apiResponse').ApiError.badRequest('No file uploaded');
  const data = await userService.uploadAvatar(req.user.id, req.file);
  successResponse(res, data, 'Avatar updated');
});

// POST /api/v1/users/cover
router.post('/cover', authenticate, upload.single('cover'), async (req, res) => {
  if (!req.file) throw require('../utils/apiResponse').ApiError.badRequest('No file uploaded');
  const data = await userService.uploadCover(req.user.id, req.file);
  successResponse(res, data, 'Cover photo updated');
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
// People search (transfer recipient picker). A search term is required so the
// whole user list can't be paged out; private profiles only match their exact
// username, and banned accounts never show.
router.get('/directory/list', async (req, res) => {
  const { role } = req.query;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().replace(/^@/, '').slice(0, 60) : '';
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 50);
  const skip = (page - 1) * limit;
  if (search.length < 2) return paginatedResponse(res, [], paginate(page, limit, 0));

  const where = {
    isBanned: false,
    OR: [
      { isPublic: true, OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ] },
      { username: { equals: search, mode: 'insensitive' } },
    ],
  };
  if (['WORKER', 'POSTER', 'ADMIN'].includes(role)) where.role = role;

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
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  paginatedResponse(res, users, paginate(page, limit, total));
});

// A public profile's owner: private and banned profiles are "not found"
const findPublicUser = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username: String(username) },
    select: { id: true, username: true, isPublic: true, isBanned: true },
  });
  if (!user || user.isBanned || user.isPublic === false) throw ApiError.notFound('User not found');
  return user;
};

// GET /api/v1/users/public/:username/reviews — job ratings from posters + store reviews
router.get('/public/:username/reviews', async (req, res) => {
  const user = await findPublicUser(req.params.username);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const who = { select: { username: true, firstName: true, lastName: true, avatarUrl: true } };

  const [jobs, products] = await Promise.all([
    prisma.taskSubmission.findMany({
      where: { workerId: user.id, rating: { not: null } },
      orderBy: { reviewedAt: 'desc' },
      take: 500,
      select: {
        id: true, rating: true, feedback: true, reviewedAt: true, createdAt: true,
        task: { select: { id: true, title: true, hiredWorkerId: true, poster: who } },
      },
    }),
    prisma.storeReview.findMany({
      where: { item: { sellerId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, rating: true, comment: true, createdAt: true, item: { select: { id: true, name: true } }, user: who },
    }),
  ]);

  const person = (u) => u && { username: u.username, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username, avatarUrl: u.avatarUrl };
  const all = [
    ...jobs.map((s) => ({
      id: 'job-' + s.id,
      kind: 'job',
      rating: s.rating,
      text: s.feedback || null,
      date: s.reviewedAt || s.createdAt,
      // A private hire's title stays private
      subject: s.task?.hiredWorkerId ? { title: 'Private job' } : { id: s.task?.id, title: s.task?.title },
      reviewer: person(s.task?.poster),
    })),
    ...products.map((r) => ({
      id: 'product-' + r.id,
      kind: 'product',
      rating: r.rating,
      text: r.comment || null,
      date: r.createdAt,
      subject: { id: r.item?.id, title: r.item?.name },
      reviewer: person(r.user),
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of all) if (distribution[r.rating] !== undefined) distribution[r.rating]++;
  const average = all.length ? all.reduce((sum, r) => sum + r.rating, 0) / all.length : 0;

  successResponse(res, {
    average: Math.round(average * 10) / 10,
    total: all.length,
    distribution,
    reviews: all.slice((page - 1) * limit, page * limit),
    page,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  });
});

// GET /api/v1/users/public/:username/products — what they sell in the store
router.get('/public/:username/products', async (req, res) => {
  const user = await findPublicUser(req.params.username);
  const items = await prisma.storeItem.findMany({
    where: { sellerId: user.id, isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { reviews: { select: { rating: true } } },
  });
  successResponse(res, items.map((item) => {
    const ratings = item.reviews.map((r) => r.rating);
    return {
      id: item.id,
      title: item.name,
      description: item.description,
      price: parseFloat(item.price),
      currency: item.currency,
      image: item.imageUrl || '',
      category: item.category,
      stock: item.stock,
      rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      reviewsCount: ratings.length,
      delivery: item.metadata?.delivery ? String(item.metadata.delivery).slice(0, 30) : null,
      revisions: item.metadata?.revisions ?? null,
      createdAt: item.createdAt,
    };
  }));
});

// GET /api/v1/users/public/:username/portfolio
const PORTFOLIO_FIELDS = { id: true, title: true, description: true, url: true, imageUrl: true, position: true, createdAt: true };
router.get('/public/:username/portfolio', async (req, res) => {
  const user = await findPublicUser(req.params.username);
  const items = await prisma.portfolioItem.findMany({
    where: { userId: user.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    select: PORTFOLIO_FIELDS,
  });
  successResponse(res, items);
});

// Own portfolio: list / add / edit / remove
const PORTFOLIO_MAX = 30;
router.get('/me/portfolio', authenticate, async (req, res) => {
  const items = await prisma.portfolioItem.findMany({
    where: { userId: req.user.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    select: PORTFOLIO_FIELDS,
  });
  successResponse(res, items);
});

router.post('/me/portfolio', authenticate, validate(portfolioItemSchema), async (req, res) => {
  const count = await prisma.portfolioItem.count({ where: { userId: req.user.id } });
  if (count >= PORTFOLIO_MAX) throw ApiError.badRequest(`You can have up to ${PORTFOLIO_MAX} portfolio items`);
  const { title, description, url, imageUrl, position } = req.body;
  const item = await prisma.portfolioItem.create({
    data: { userId: req.user.id, title, description: description || null, url: url || null, imageUrl: imageUrl || null, position: position ?? count },
    select: PORTFOLIO_FIELDS,
  });
  successResponse(res, item, 'Portfolio item added');
});

router.patch('/me/portfolio/:id', authenticate, validate(portfolioItemSchema.partial()), async (req, res) => {
  const { title, description, url, imageUrl, position } = req.body;
  const data = {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description: description || null }),
    ...(url !== undefined && { url: url || null }),
    ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
    ...(position !== undefined && { position }),
  };
  // Scoped to the owner: someone else's id updates nothing
  const { count } = await prisma.portfolioItem.updateMany({ where: { id: req.params.id, userId: req.user.id }, data });
  if (!count) throw ApiError.notFound('Portfolio item not found');
  const item = await prisma.portfolioItem.findUnique({ where: { id: req.params.id }, select: PORTFOLIO_FIELDS });
  successResponse(res, item, 'Portfolio item updated');
});

router.delete('/me/portfolio/:id', authenticate, async (req, res) => {
  const { count } = await prisma.portfolioItem.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  if (!count) throw ApiError.notFound('Portfolio item not found');
  successResponse(res, null, 'Portfolio item removed');
});

// POST /api/v1/users/:username/hire — private direct hire (escrowed like any job)
router.post('/:username/hire', authenticate, validate(hireSchema), async (req, res) => {
  const data = await taskService.hireWorker(req.user.id, req.params.username, req.body);
  successResponse(res, data, 'Hire created and funds escrowed');
});

// GET /api/v1/users/public/:username/blogs
router.get('/public/:username/blogs', async (req, res) => {
  const user = await findPublicUser(req.params.username);
  const posts = await prisma.blogPost.findMany({
    where: { authorId: user.id, isPublished: true },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, excerpt: true, slug: true, coverImage: true, tags: true, publishedAt: true, createdAt: true },
  });
  successResponse(res, posts);
});


// GET /api/v1/users/public/:username/communities
router.get('/public/:username/communities', async (req, res) => {
  const user = await findPublicUser(req.params.username);

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

// GET /api/v1/users/:username — keep last: it would shadow /search and /bookmarks
router.get("/:username", async (req, res) => {
  const data = await userService.getPublicProfile(req.params.username);
  successResponse(res, data, 'Profile fetched');
});
