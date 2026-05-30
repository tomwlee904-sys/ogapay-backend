'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');

const router = express.Router();

// GET /api/v1/store — Browse store items
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, category } = req.query;
  const skip = (page - 1) * limit;
  const where = { isActive: true, ...(category && { category }) };

  const [items, total] = await Promise.all([
    prisma.storeItem.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.storeItem.count({ where }),
  ]);

  paginatedResponse(res, items, paginate(page, limit, total));
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
