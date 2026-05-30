'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate, kycSubmitSchema } = require('../middleware/validate');
const kycService = require('../services/kyc.service');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/v1/kyc/status
router.get('/status', authenticate, async (req, res) => {
  const data = await kycService.getKycStatus(req.user.id);
  successResponse(res, data, 'KYC status fetched');
});

// POST /api/v1/kyc/submit
router.post('/submit', authenticate, validate(kycSubmitSchema), async (req, res) => {
  const data = await kycService.submitKyc(req.user.id, req.body);
  successResponse(res, data, data.message);
});

// POST /api/v1/kyc/documents/:type — Upload ID docs
// type: id_front | id_back | selfie
router.post('/documents/:type', authenticate, upload.single('document'), async (req, res) => {
  const { type } = req.params;
  const allowed = ['id_front', 'id_back', 'selfie'];
  if (!allowed.includes(type)) {
    throw require('../utils/apiResponse').ApiError.badRequest('Invalid document type');
  }
  if (!req.file) throw require('../utils/apiResponse').ApiError.badRequest('No document uploaded');

  const url = await kycService.uploadKycDocument(req.user.id, req.file, type);
  successResponse(res, { url }, 'Document uploaded');
});

// ── Admin routes ───────────────────────────────

// GET /api/v1/kyc/admin/pending
router.get('/admin/pending', authenticate, authorize('ADMIN'), async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { records, total } = await kycService.listPendingKyc({ page, limit });
  paginatedResponse(res, records, paginate(page, limit, total));
});

// PATCH /api/v1/kyc/admin/:userId/review
router.patch('/admin/:userId/review', authenticate, authorize('ADMIN'), async (req, res) => {
  const { action, rejectionReason } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    throw require('../utils/apiResponse').ApiError.badRequest('action must be "approve" or "reject"');
  }
  const data = await kycService.adminReviewKyc(req.user.id, req.params.userId, { action, rejectionReason });
  successResponse(res, data, `KYC ${data.status.toLowerCase()}`);
});

module.exports = router;
