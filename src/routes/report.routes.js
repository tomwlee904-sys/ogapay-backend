'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  const { category, description, targetType, targetId, email } = req.body;
  if (!category || !description) throw ApiError.badRequest('Category and description are required');
  const report = await prisma.report.create({
    data: { userId: req.user.id, category, description, targetType, targetId, email }
  });
  createdResponse(res, report, 'Report submitted. Our team will review it within 24 hours.');
});

router.get('/admin', authenticate, authorize('ADMIN'), async (req, res) => {
  const { status = 'open' } = req.query;
  const reports = await prisma.report.findMany({
    where: { status }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' }
  });
  successResponse(res, reports);
});

router.patch('/admin/:id/review', authenticate, authorize('ADMIN'), async (req, res) => {
  const { status, adminNotes } = req.body;
  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: { status, adminNotes, reviewedBy: req.user.id, resolvedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : undefined }
  });
  successResponse(res, report, `Report ${status}`);
});

module.exports = router;
