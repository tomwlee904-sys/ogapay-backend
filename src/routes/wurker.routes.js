'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const router = express.Router();

router.get('/application', authenticate, async (req, res) => {
  const app = await prisma.wurkerApplication.findUnique({ where: { userId: req.user.id } });
  successResponse(res, app || { status: 'none' });
});

router.post('/apply', authenticate, async (req, res) => {
  const { storeName, category, bio } = req.body;
  if (!storeName || !category) throw ApiError.badRequest('Store name and category are required');
  const existing = await prisma.wurkerApplication.findUnique({ where: { userId: req.user.id } });
  if (existing) throw ApiError.badRequest('Application already exists');
  const app = await prisma.wurkerApplication.create({
    data: { userId: req.user.id, storeName, category, bio }
  });
  createdResponse(res, app, 'Application submitted');
});

router.get('/admin/pending', authenticate, authorize('ADMIN'), async (req, res) => {
  const apps = await prisma.wurkerApplication.findMany({ where: { status: 'pending' }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' } });
  successResponse(res, apps);
});

router.patch('/admin/:id/review', authenticate, authorize('ADMIN'), async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw ApiError.badRequest('Invalid status');
  const app = await prisma.wurkerApplication.update({
    where: { id: req.params.id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), rejectionReason }
  });
  successResponse(res, app, `Application ${status}`);
});

module.exports = router;
