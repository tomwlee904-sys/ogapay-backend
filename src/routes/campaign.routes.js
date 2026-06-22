'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const where = { userId: req.user.id, ...(status && { status }) };
  const [items, total] = await Promise.all([
    prisma.campaign.findMany({ where, skip: (page - 1) * limit, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.campaign.count({ where })
  ]);
  paginatedResponse(res, items, paginate(page, limit, total));
});

router.post('/', authenticate, async (req, res) => {
  const { name, description, platforms, budget, currency, startDate, endDate } = req.body;
  if (!name || !budget) throw ApiError.badRequest('Name and budget are required');
  const campaign = await prisma.campaign.create({
    data: { userId: req.user.id, name, description, platforms: platforms || [], budget: parseFloat(budget), currency: currency || 'NGN', startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null }
  });
  createdResponse(res, campaign, 'Campaign created');
});

router.patch('/:id', authenticate, async (req, res) => {
  const camp = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!camp) throw ApiError.notFound('Campaign not found');
  const { name, description, platforms, budget, currency, status } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (platforms !== undefined) data.platforms = platforms;
  if (budget !== undefined) data.budget = parseFloat(budget);
  if (currency !== undefined) data.currency = currency;
  if (status !== undefined) data.status = status;
  const updated = await prisma.campaign.update({ where: { id: req.params.id }, data });
  successResponse(res, updated, 'Campaign updated');
});

router.get('/:id/stats', authenticate, async (req, res) => {
  const camp = await prisma.campaign.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!camp) throw ApiError.notFound('Campaign not found');
  successResponse(res, {
    spend: Number(camp.spend),
    impressions: camp.impressions,
    clicks: camp.clicks,
    conversions: camp.conversions,
    budget: Number(camp.budget),
    remaining: Number(camp.budget) - Number(camp.spend),
    ctr: camp.impressions > 0 ? ((camp.clicks / camp.impressions) * 100).toFixed(2) : '0.00',
    conversionRate: camp.clicks > 0 ? ((camp.conversions / camp.clicks) * 100).toFixed(2) : '0.00',
  });
});

module.exports = router;
