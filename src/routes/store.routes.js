'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const { debitAvailable } = require('../utils/ledger');
const { validate, storeProductSchema, storeProductUpdateSchema } = require('../middleware/validate');
const walletService = require('../services/wallet.service');

const router = express.Router();

// GET /api/v1/store — Browse store items
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, category, search, sort } = req.query;
  const skip = (page - 1) * limit;

  const where = { isActive: true, deletedAt: null };
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
      metadata: publicMeta(item.metadata),
      createdAt: item.createdAt,
    };
  });

  paginatedResponse(res, mapped, paginate(page, limit, total));
});

// GET /api/v1/store/workers — Browse workers
router.get('/workers', async (req, res) => {
  const { page = 1, limit = 20, search, sort, category } = req.query;
  const skip = (page - 1) * limit;

  const where = { isAvailable: true, user: { isBanned: false } };
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
    where: { sellerId: req.user.id, deletedAt: null }, // drafts too; deleted ones are gone
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
    const meta = (item.metadata || {});
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      currency: item.currency,
      imageUrl: item.imageUrl,
      category: item.category,
      subcategory: meta.subcategory || '',
      stock: item.stock,
      isActive: item.isActive,
      sales,
      revenue,
      orders: item.purchases.length,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      reviewsCount: ratings.length,
      status: item.isActive ? 'Active' : 'Draft',
      revisions: meta.revisions || 3,
      delivery: meta.delivery || '3 days',
      tags: meta.tags || [],
      createdAt: item.createdAt,
    };
  });

  successResponse(res, { products: mapped, total: mapped.length, sales: mapped.reduce((s, p) => s + p.sales, 0), revenue: mapped.reduce((s, p) => s + p.revenue, 0) }, 'My products fetched');
});

// POST /api/v1/store/products — Create product
router.post('/products', authenticate, validate(storeProductSchema), async (req, res) => {
  const { name, description, price, currency, category, imageUrl, stock, subcategory, revisions, delivery, tags, status } = req.body;
  const extra = { subcategory, revisions, delivery, tags };
  const metadata = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== null && v !== ''));

  const item = await prisma.storeItem.create({
    data: {
      sellerId: req.user.id,
      name,
      description,
      price,
      currency,
      category,
      imageUrl: imageUrl || null,
      stock: stock ?? null,
      isActive: status !== 'DRAFT',
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
  });

  createdResponse(res, item, 'Product created');
});

// PATCH /api/v1/store/products/:id — Update product
router.patch('/products/:id', authenticate, validate(storeProductUpdateSchema), async (req, res) => {
  const item = await prisma.storeItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw ApiError.notFound('Product not found');
  if (item.sellerId !== req.user.id) throw ApiError.forbidden('Not your product');
  if (item.deletedAt) throw ApiError.notFound('Product not found');

  const { name, description, price, currency, category, imageUrl, stock, status, subcategory, revisions, delivery, tags } = req.body;
  const effCurrency = currency ?? item.currency;
  const effPrice = price ?? Number(item.price);
  if (effCurrency === 'NGN' && effPrice < 100) throw ApiError.badRequest('Minimum price is ₦100');
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = price;
  if (currency !== undefined) data.currency = currency;
  if (category !== undefined) data.category = category;
  if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
  if (stock !== undefined) data.stock = stock ?? null;
  if (status !== undefined) data.isActive = status === 'ACTIVE';

  const extra = { subcategory, revisions, delivery, tags };
  const newMeta = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== null));
  if (Object.keys(newMeta).length > 0) {
    data.metadata = { ...(item.metadata || {}), ...newMeta };
  }

  const updated = await prisma.storeItem.update({
    where: { id: req.params.id },
    data,
  });

  successResponse(res, updated, 'Product updated');
});

// DELETE /api/v1/store/products/:id — Delete product
router.delete('/products/:id', authenticate, async (req, res) => {
  const item = await prisma.storeItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw ApiError.notFound('Product not found');
  if (item.sellerId !== req.user.id) throw ApiError.forbidden('Not your product');

  // Soft delete: past orders still point at it
  await prisma.storeItem.update({ where: { id: req.params.id }, data: { isActive: false, deletedAt: new Date() } });
  successResponse(res, null, 'Product removed');
});

// GET /api/v1/store/my-stats — Seller dashboard stats
router.get('/my-stats', authenticate, async (req, res) => {
  const [products, purchases] = await Promise.all([
    prisma.storeItem.findMany({ where: { sellerId: req.user.id, deletedAt: null }, select: { id: true, isActive: true } }),
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

// Only these seller-set fields are public (older items may carry other keys)
function publicMeta(meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const out = {};
  if (m.delivery) out.delivery = String(m.delivery).slice(0, 30);
  if (m.revisions !== undefined && m.revisions !== null) out.revisions = Number(m.revisions);
  if (m.subcategory) out.subcategory = String(m.subcategory).slice(0, 60);
  if (Array.isArray(m.tags)) out.tags = m.tags.slice(0, 8).map((t) => String(t).slice(0, 30));
  return out;
}

const ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'DELIVERED'];

// GET /api/v1/store/my-orders — what people bought from me
router.get('/my-orders', authenticate, async (req, res) => {
  const orders = await prisma.storePurchase.findMany({
    where: { item: { sellerId: req.user.id } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, quantity: true, totalPrice: true, currency: true, status: true, createdAt: true,
      item: { select: { id: true, name: true, imageUrl: true } },
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });
  // The chat the purchase opened with each buyer
  const buyerIds = [...new Set(orders.map((o) => o.user.id))];
  const convs = buyerIds.length ? await prisma.conversation.findMany({
    where: { AND: [{ participants: { some: { userId: req.user.id } } }, { participants: { some: { userId: { in: buyerIds } } } }] },
    select: { id: true, participants: { select: { userId: true } } },
  }) : [];
  const convFor = (buyerId) => convs.find((c) => c.participants.some((p) => p.userId === buyerId))?.id || null;

  successResponse(res, orders.map((o) => ({
    id: o.id,
    quantity: o.quantity,
    total: parseFloat(o.totalPrice),
    currency: o.currency,
    status: ORDER_STATUSES.includes(o.status) ? o.status : 'PENDING',
    createdAt: o.createdAt,
    product: o.item,
    buyer: { username: o.user.username, name: [o.user.firstName, o.user.lastName].filter(Boolean).join(' ') || o.user.username, avatarUrl: o.user.avatarUrl },
    conversationId: convFor(o.user.id),
  })));
});

// PATCH /api/v1/store/orders/:id — seller moves an order along; the buyer is told
router.patch('/orders/:id', authenticate, async (req, res) => {
  const status = String(req.body?.status || '').toUpperCase();
  if (!['IN_PROGRESS', 'DELIVERED'].includes(status)) throw ApiError.badRequest('Status must be IN_PROGRESS or DELIVERED');
  const order = await prisma.storePurchase.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, userId: true, item: { select: { sellerId: true, name: true } } },
  });
  if (!order || order.item.sellerId !== req.user.id) throw ApiError.notFound('Order not found');
  if (order.status === 'DELIVERED') throw ApiError.conflict('This order is already delivered');
  const { count } = await prisma.storePurchase.updateMany({ where: { id: order.id, status: order.status }, data: { status } });
  if (!count) throw ApiError.conflict('The order changed; refresh and try again');
  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: 'STORE_ORDER_UPDATE',
      title: status === 'DELIVERED' ? '📦 Your order was delivered' : '🛠️ Your order is in progress',
      body: `${order.item.name}: ${status === 'DELIVERED' ? 'the seller marked it delivered.' : 'the seller has started working on it.'}`,
      data: { purchaseId: order.id },
    },
  }).catch(() => {});
  successResponse(res, { id: order.id, status }, 'Order updated');
});

// GET /api/v1/store/:id — Single product detail
router.get('/:id', async (req, res) => {
  const item = await prisma.storeItem.findUnique({
    where: { id: req.params.id },
    include: {
      seller: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      reviews: {
        select: { id: true, rating: true, comment: true, createdAt: true, userId: true, user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
  if (!item || item.deletedAt) throw ApiError.notFound('Product not found');

  const ratings = item.reviews.map(r => r.rating);
  successResponse(res, {
    id: item.id,
    title: item.name,
    name: item.name,
    description: item.description,
    price: parseFloat(item.price),
    currency: item.currency,
    seller: item.seller ? (item.seller.username || `${item.seller.firstName} ${item.seller.lastName}`) : 'OgaPay',
    sellerId: item.seller?.id,
    sellerAvatar: item.seller?.avatarUrl || null,
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    reviewsCount: ratings.length,
    reviews: item.reviews.map(r => ({
      id: r.id,
      userId: r.userId,
      username: r.user.username || `${r.user.firstName} ${r.user.lastName}`,
      avatarUrl: r.user.avatarUrl,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    image: item.imageUrl || '',
    category: item.category,
    stock: item.stock,
    isActive: item.isActive,
    metadata: publicMeta(item.metadata),
    createdAt: item.createdAt,
  }, 'Product fetched');
});

// POST /api/v1/store/:itemId/purchase
router.post('/:itemId/purchase', authenticate, async (req, res) => {
  const { itemId } = req.params;
  // A negative quantity used to move money from the seller to the buyer
  const quantity = Number(req.body.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw ApiError.badRequest('Quantity must be a whole number from 1 to 100');
  }

  const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
  if (!item || !item.isActive) throw ApiError.notFound('Item not found or unavailable');
  if (!item.sellerId) throw ApiError.badRequest('Product has no seller');
  if (item.sellerId === req.user.id) throw ApiError.badRequest('You cannot purchase your own product');

  const currency = item.currency;
  if (item.stock !== null && item.stock < quantity) throw ApiError.badRequest('Insufficient stock');

  const totalPrice = parseFloat(item.price) * quantity;
  // Existing items with a zero/negative price must never be bought (money would flow backwards)
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) throw ApiError.badRequest('This product is not available for purchase');

  // Load wallets for buyer and seller
  const [buyerWallet, sellerWallet] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId_currency: { userId: req.user.id, currency } } }),
    prisma.wallet.findUnique({ where: { userId_currency: { userId: item.sellerId, currency } } }),
  ]);
  if (!buyerWallet) throw ApiError.notFound('Buyer wallet not found');
  if (!sellerWallet) throw ApiError.notFound('Seller wallet not found');

  const available = parseFloat(buyerWallet.balance) - parseFloat(buyerWallet.lockedBalance);
  if (available < totalPrice) throw ApiError.badRequest('Insufficient wallet balance');

  const purchase = await prisma.$transaction(async (db) => {
    // 1. Debit buyer in one guarded step: two purchases at once can't overdraw
    if (!(await debitAvailable(db, buyerWallet.id, totalPrice))) {
      throw ApiError.badRequest('Insufficient wallet balance');
    }

    const ref = `OGA-STORE-${Date.now()}`;

    await db.transaction.create({
      data: {
        userId: req.user.id,
        walletId: buyerWallet.id,
        type: 'STORE_PURCHASE',
        status: 'COMPLETED',
        amount: totalPrice,
        currency,
        reference: ref,
        balanceBefore: buyerWallet.balance,
        balanceAfter: parseFloat(buyerWallet.balance) - totalPrice,
        description: `Purchase: ${item.name}`,
        completedAt: new Date(),
      },
    });

    // 2. Credit seller
    const newSellerBalance = parseFloat(sellerWallet.balance) + totalPrice;
    await db.wallet.update({
      where: { id: sellerWallet.id },
      data: { balance: { increment: totalPrice } },
    });

    await db.transaction.create({
      data: {
        userId: item.sellerId,
        walletId: sellerWallet.id,
        type: 'STORE_PURCHASE',
        status: 'COMPLETED',
        amount: totalPrice,
        currency,
        reference: ref + '-SELLER',
        balanceBefore: sellerWallet.balance,
        balanceAfter: newSellerBalance,
        description: `Sale: ${item.name} (purchased by ${req.user.firstName || 'a buyer'})`,
        completedAt: new Date(),
      },
    });

    // 3. Create store purchase record
    const storePurchase = await db.storePurchase.create({
      data: { userId: req.user.id, itemId, quantity, totalPrice, currency },
    });

    // 4. Decrement stock if applicable (race-condition safe: where includes gte guard)
    if (item.stock !== null) {
      const result = await db.storeItem.updateMany({
        where: { id: itemId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (result.count === 0) {
        // Stock was insufficient at the moment of update — rollback the entire transaction
        throw new Error('Insufficient stock');
      }
    }

    // 5. Find or create conversation between buyer and seller
    const existingConv = await db.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: req.user.id } } },
          { participants: { some: { userId: item.sellerId } } },
        ],
      },
    });

    let conversationId = existingConv?.id;
    if (!conversationId) {
      const conv = await db.conversation.create({
        data: {
          participants: {
            create: [
              { userId: req.user.id },
              { userId: item.sellerId },
            ],
          },
        },
      });
      conversationId = conv.id;
    }

    // 6. Add system message about the purchase
    const buyerName = req.user.firstName || req.user.username || 'A buyer';
    await db.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        content: `🛒 ${buyerName} purchased ${item.name} for ${totalPrice.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:6})} ${currency}. Arrange next steps here.`,
      },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // 7. Notify seller
    await db.notification.create({
      data: {
        userId: item.sellerId,
        type: 'STORE_PURCHASE',
        title: '🛒 New Purchase!',
        body: `${buyerName} purchased ${item.name} for ${totalPrice.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:6})} ${currency}.`,
        data: { purchaseId: storePurchase.id, conversationId, itemId, buyerId: req.user.id },
      },
    });

    // Auto-convert USDC to NGN if seller has the preference enabled
    if (currency === 'USDC') {
      try {
        await walletService.autoConvertUsdcToNgn(item.sellerId, { db });
      } catch (e) {
        // Non-blocking — payment already succeeded
        console.error(`Post-purchase auto-convert failed for seller ${item.sellerId}: ${e.message}`);
      }
    }

    return { ...storePurchase, conversationId };
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
