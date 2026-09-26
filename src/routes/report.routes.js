'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const { validate, supportTicketSchema } = require('../middleware/validate');
const router = express.Router();

// Stops one account flooding the admin queue
const HOURLY_LIMIT = 5;
async function checkRate(userId) {
  const recent = await prisma.report.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
  if (recent >= HOURLY_LIMIT) throw ApiError.tooManyRequests('You have sent several requests in the last hour. Please wait a little before sending another.');
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

router.post('/', authenticate, async (req, res) => {
  const category = str(req.body.category, 40);
  const description = str(req.body.description, 5000);
  const targetType = str(req.body.targetType, 30);
  const targetId = str(req.body.targetId, 100);
  const email = str(req.body.email, 200);
  if (!category || !description) throw ApiError.badRequest('Category and description are required');
  await checkRate(req.user.id);
  const report = await prisma.report.create({
    data: { userId: req.user.id, category, description, targetType, targetId, email }
  });
  createdResponse(res, report, 'Report submitted. Our team will review it within 24 hours.');
});

// POST /api/v1/reports/support - open a support ticket
router.post('/support', authenticate, validate(supportTicketSchema), async (req, res) => {
  const { subject, category, description, email } = req.body;
  await checkRate(req.user.id);
  const ticket = await prisma.report.create({
    data: { userId: req.user.id, targetType: 'support', subject, category, description, email: email || null },
    select: { id: true, subject: true, category: true, status: true, createdAt: true },
  });
  createdResponse(res, ticket, "Ticket sent. We'll reply by email within 24 hours.");
});

// GET /api/v1/reports/mine - my tickets and reports (admin notes stay internal)
router.get('/mine', authenticate, async (req, res) => {
  const items = await prisma.report.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, subject: true, category: true, description: true, targetType: true, status: true, createdAt: true, resolvedAt: true },
  });
  successResponse(res, items.map((r) => ({ ...r, description: r.description.slice(0, 280) })));
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
