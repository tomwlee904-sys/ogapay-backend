'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  const { targetType, targetId, requestType, description } = req.body;
  if (!targetType || !requestType || !description) throw ApiError.badRequest('Missing required fields');
  const er = await prisma.editRequest.create({
    data: { userId: req.user.id, targetType, targetId, requestType, description }
  });
  createdResponse(res, er, 'Edit request submitted');
});

router.get('/admin', authenticate, authorize('ADMIN'), async (req, res) => {
  const requests = await prisma.editRequest.findMany({
    where: { status: 'open' }, include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }
  });
  successResponse(res, requests);
});

router.patch('/admin/:id/review', authenticate, authorize('ADMIN'), async (req, res) => {
  const { status } = req.body;
  const er = await prisma.editRequest.update({
    where: { id: req.params.id }, data: { status, resolvedAt: new Date() }
  });
  successResponse(res, er, `Request ${status}`);
});

module.exports = router;
