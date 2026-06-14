'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const router = express.Router();

const SERVICE_PRICES = {
  x: { likes: 150, followers: 250, reposts: 150, comments: 150, bookmarks: 150 },
  instagram: { likes: 150, comments: 150, followers: 250 },
  youtube: { likes: 150, comments: 150, subscribers: 250 },
  telegram: { members: 250 },
  discord: { members: 250 },
};

router.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const [items, total] = await Promise.all([
    prisma.socialServiceOrder.findMany({ where: { userId: req.user.id }, skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.socialServiceOrder.count({ where: { userId: req.user.id } })
  ]);
  paginatedResponse(res, items, paginate(page, limit, total));
});

router.post('/order', authenticate, async (req, res) => {
  const { platform, service, quantity = 1, targetUrl } = req.body;
  if (!platform || !service) throw ApiError.badRequest('Platform and service are required');
  const platformPrices = SERVICE_PRICES[platform];
  if (!platformPrices || !platformPrices[service]) throw ApiError.badRequest('Invalid platform or service');
  const unitPrice = platformPrices[service];
  const totalPrice = unitPrice * quantity;

  const wallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId: req.user.id, currency: 'NGN' } } });
  if (!wallet) throw ApiError.notFound('Wallet not found');
  const available = parseFloat(wallet.balance) - parseFloat(wallet.lockedBalance);
  if (available < totalPrice) throw ApiError.badRequest('Insufficient balance');

  const order = await prisma.$transaction(async (db) => {
    await db.wallet.update({ where: { id: wallet.id }, data: { lockedBalance: { increment: totalPrice } } });
    return db.socialServiceOrder.create({
      data: { userId: req.user.id, platform, service, quantity, unitPrice, totalPrice, targetUrl }
    });
  });
  createdResponse(res, order, 'Order placed');
});

module.exports = router;
