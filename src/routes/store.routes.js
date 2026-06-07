'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');

const router = express.Router();

// GET /api/v1/store — Browse store items
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, category, search, sort } = req.query;
  const skip = (page - 1) * limit;

  const where = { isActive: true };
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  let orderBy;
  switch (sort) {
    case 'newest': orderBy = { createdAt: 'desc' }; break;
    case 'stars_desc': orderBy = { reviews: { _count: 'desc' } }; break;
    case 'random': orderBy = { id: 'asc' }; break;
    default: orderBy = { createdAt: 'desc' };
  }

  const [items, total] = await Promise.all([
    prisma.storeItem.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy,
      include: {
        seller: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
        reviews: { select: { rating: true } },
      },
    }),
    prisma.storeItem.count({ where }),
  ]);

  const mapped = items.map(item => {
    const ratings = item.reviews.map(r => r.rating);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    return {
      id: item.id,
      title: item.name,
      description: item.description,
      price: parseFloat(item.price),
      currency: item.currency,
      seller: item.seller ? (item.seller.username || `${item.seller.firstName} ${item.seller.lastName}`) : 'OgaPay',
      sellerAvatar: item.seller?.avatarUrl || null,
      rating: avgRating,
      reviewsCount: ratings.length,
      image: item.imageUrl || '',
      category: item.category,
      stock: item.stock,
      createdAt: item.createdAt,
    };
  });

  paginatedResponse(res, mapped, paginate(page, limit, total));
});

// GET /api/v1/store/workers — Browse workers
router.get('/workers', async (req, res) => {
  const { page = 1, limit = 20, search, sort, category } = req.query;
  const skip = (page - 1) * limit;

  const where = { isAvailable: true };
  if (search) {
    where.OR = [
      { bio: { contains: search, mode: 'insensitive' } },
      { skills: { has: search } },
      { user: { username: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (category) {
    where.skills = { has: category };
  }

  let orderBy;
  switch (sort) {
    case 'rating': orderBy = { avgRating: 'desc' }; break;
    case 'newest': orderBy = { createdAt: 'desc' }; break;
    case 'active': orderBy = { tasksCompleted: 'desc' }; break;
    default: orderBy = { reputationScore: 'desc' };
  }

  const [profiles, total] = await Promise.all([
    prisma.workerProfile.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy,
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.workerProfile.count({ where }),
  ]);

  const mapped = profiles.map(p => ({
    id: p.userId,
    username: p.user.username || `${p.user.firstName} ${p.user.lastName}`,
    avatarUrl: p.user.avatarUrl,
    bio: p.bio || 'No bio available yet',
    rating: p.avgRating,
    reviews: p.totalRatings,
    level: p.level,
    skills: p.skills,
    tasksCompleted: p.tasksCompleted,
    successRate: p.successRate,
    isAvailable: p.isAvailable,
  }));

  paginatedResponse(res, mapped, paginate(page, limit, total));
});

// GET /api/v1/store/workers/:id — Worker profile
router.get('/workers/:id', async (req, res) => {
  const profile = await prisma.workerProfile.findUnique({
    where: { userId: req.params.id },
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true, lastName: true,
          avatarUrl: true, role: true, createdAt: true,
        },
      },
    },
  });

  if (!profile) throw ApiError.notFound('Worker not found');

  const productCount = await prisma.storeItem.count({ where: { sellerId: req.params.id, isActive: true } });

  const data = {
    id: profile.userId,
    username: profile.user.username || `${profile.user.firstName} ${profile.user.lastName}`,
    avatarUrl: profile.user.avatarUrl,
    role: profile.user.role,
    bio: profile.bio || 'No bio available yet',
    rating: profile.avgRating,
    reviews: profile.totalRatings,
    level: profile.level,
    skills: profile.skills,
    tasksCompleted: profile.tasksCompleted,
    successRate: profile.successRate,
    isAvailable: profile.isAvailable,
    memberSince: profile.user.createdAt,
    productCount,
  };

  successResponse(res, data, 'Worker profile fetched');
});

// GET /api/v1/store/:itemId/reviews — Product reviews
router.get('/:itemId/reviews', async (req, res) => {
  const reviews = await prisma.storeReview.findMany({
    where: { itemId: req.params.itemId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  const mapped = reviews.map(r => ({
    id: r.id,
    userId: r.userId,
    username: r.user.username || `${r.user.firstName} ${r.user.lastName}`,
    avatarUrl: r.user.avatarUrl,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));

  successResponse(res, mapped, 'Reviews fetched');
});

// POST /api/v1/store/:itemId/reviews — Submit review
router.post('/:itemId/reviews', authenticate, async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) throw ApiError.badRequest('Rating must be between 1 and 5');

  const item = await prisma.storeItem.findUnique({ where: { id: req.params.itemId } });
  if (!item || !item.isActive) throw ApiError.notFound('Item not found');

  const existing = await prisma.storeReview.findUnique({
    where: { itemId_userId: { itemId: req.params.itemId, userId: req.user.id } },
  });
  if (existing) throw ApiError.badRequest('You have already reviewed this item');

  const review = await prisma.storeReview.create({
    data: { itemId: req.params.itemId, userId: req.user.id, rating, comment },
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  createdResponse(res, {
    id: review.id,
    userId: review.userId,
    username: review.user.username || `${review.user.firstName} ${review.user.lastName}`,
    avatarUrl: review.user.avatarUrl,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  }, 'Review submitted');
});

// GET /api/v1/store/my-products — Seller's own products
router.get('/my-products', authenticate, async (req, res) => {
  const items = await prisma.storeItem.findMany({
    where: { sellerId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      purchases: { select: { id: true, quantity: true, totalPrice: true, createdAt: true } },
      reviews: { select: { rating: true } },
    },
  });

  const mapped = items.map(item => {
    const ratings = item.reviews.map(r => r.rating);
    const sales = item.purchases.reduce((sum, p) => sum + p.quantity, 0);
    const revenue = item.purchases.reduce((sum, p) => sum + parseFloat(p.totalPrice), 0);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      currency: item.currency,
      imageUrl: item.imageUrl,
      category: item.category,
      stock: item.stock,
      isActive: item.isActive,
      sales,
      revenue,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      reviewsCount: ratings.length,
      status: item.isActive ? 'Active' : 'Draft',
      createdAt: item.createdAt,
    };
  });

  successResponse(res, { products: mapped, total: mapped.length, sales: mapped.reduce((s, p) => s + p.sales, 0), revenue: mapped.reduce((s, p) => s + p.revenue, 0) }, 'My products fetched');
});

// POST /api/v1/store/products — Create product
router.post('/products', authenticate, async (req, res) => {
  const { name, description, price, currency, category, imageUrl, stock } = req.body;
  if (!name || !description || !price || !category) throw ApiError.badRequest('Name, description, price, and category are required');

  const item = await prisma.storeItem.create({
    data: {
      sellerId: req.user.id,
      name,
      description,
      price: parseFloat(price),
      currency: currency || 'NGN',
      category,
      imageUrl,
      stock: stock ? parseInt(stock) : null,
    },
  });

  createdResponse(res, item, 'Product created');
});

// PATCH /api/v1/store/products/:id — Update product
router.patch('/products/:id', authenticate, async (req, res) => {
  const item = await prisma.storeItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw ApiError.notFound('Product not found');
  if (item.sellerId !== req.user.id) throw ApiError.forbidden('Not your product');

  const updated = await prisma.storeItem.update({
    where: { id: req.params.id },
    data: req.body,
  });

  successResponse(res, updated, 'Product updated');
});

// DELETE /api/v1/store/products/:id — Delete product
router.delete('/products/:id', authenticate, async (req, res) => {
  const item = await prisma.storeItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw ApiError.notFound('Product not found');
  if (item.sellerId !== req.user.id) throw ApiError.forbidden('Not your product');

  await prisma.storeItem.update({ where: { id: req.params.id }, data: { isActive: false } });
  successResponse(res, null, 'Product removed');
});

// GET /api/v1/store/my-stats — Seller dashboard stats
router.get('/my-stats', authenticate, async (req, res) => {
  const [products, purchases] = await Promise.all([
    prisma.storeItem.findMany({ where: { sellerId: req.user.id }, select: { id: true, isActive: true } }),
    prisma.storePurchase.findMany({
      where: { item: { sellerId: req.user.id } },
      select: { totalPrice: true, quantity: true, status: true },
    }),
  ]);

  const stats = {
    products: products.length,
    activeProducts: products.filter(p => p.isActive).length,
    orders: purchases.length,
    sales: purchases.reduce((s, p) => s + parseFloat(p.totalPrice), 0),
    pendingOrders: purchases.filter(p => p.status === 'PENDING').length,
  };

  successResponse(res, stats, 'Store stats fetched');
});

// POST /api/v1/store/:itemId/purchase
router.post('/:itemId/purchase', authenticate, async (req, res) => {
  const { itemId } = req.params;
  const { quantity = 1, currency = 'NGN' } = req.body;

  const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
  if (!item || !item.isActive) throw ApiError.notFound('Item not found or unavailable');
  if (item.stock !== null && item.stock < quantity) throw ApiError.badRequest('Insufficient stock');

  const totalPrice = parseFloat(item.price) * quantity;

  // Deduct from wallet
  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: req.user.id, currency } },
  });
  if (!wallet) throw ApiError.notFound('Wallet not found');
  const available = parseFloat(wallet.balance) - parseFloat(wallet.lockedBalance);
  if (available < totalPrice) throw ApiError.badRequest('Insufficient wallet balance');

  const purchase = await prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: totalPrice } },
    });

    const ref = `OGA-STORE-${Date.now()}`;
    await db.transaction.create({
      data: {
        userId: req.user.id,
        walletId: wallet.id,
        type: 'STORE_PURCHASE',
        status: 'COMPLETED',
        amount: totalPrice,
        currency,
        reference: ref,
        balanceBefore: wallet.balance,
        balanceAfter: parseFloat(wallet.balance) - totalPrice,
        description: `Purchase: ${item.name}`,
        completedAt: new Date(),
      },
    });

    const storePurchase = await db.storePurchase.create({
      data: { userId: req.user.id, itemId, quantity, totalPrice, currency },
    });

    if (item.stock !== null) {
      await db.storeItem.update({ where: { id: itemId }, data: { stock: { decrement: quantity } } });
    }

    return storePurchase;
  });

  createdResponse(res, purchase, 'Purchase successful');
});

// ── Admin: Manage store items ──────────────────

// POST /api/v1/store/admin/items
router.post('/admin/items', authenticate, authorize('ADMIN'), async (req, res) => {
  const { name, description, price, currency, category, imageUrl, stock } = req.body;
  const item = await prisma.storeItem.create({
    data: { name, description, price, currency, category, imageUrl, stock },
  });
  createdResponse(res, item, 'Store item created');
});

// PATCH /api/v1/store/admin/items/:itemId
router.patch('/admin/items/:itemId', authenticate, authorize('ADMIN'), async (req, res) => {
  const item = await prisma.storeItem.update({
    where: { id: req.params.itemId },
    data: req.body,
  });
  successResponse(res, item, 'Item updated');
});

module.exports = router;
