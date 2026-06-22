'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate, kycSubmitSchema } = require('../middleware/validate');
const kycService = require('../services/kyc.service');
const { ApiError, successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/v1/kyc/status
router.get('/status', authenticate, async (req, res) => {
  const data = await kycService.getKycStatus(req.user.id);
  successResponse(res, data, 'KYC status fetched');
});

// POST /api/v1/kyc/submit — Submit KYC with Dojah live verification
router.post('/submit', authenticate, validate(kycSubmitSchema), async (req, res) => {
  const data = await kycService.submitKyc(req.user.id, req.body);
  successResponse(res, data, data.message);
});

// POST /api/v1/kyc/resubmit — Resubmit after rejection
router.post('/resubmit', authenticate, validate(kycSubmitSchema), async (req, res) => {
  const data = await kycService.submitKyc(req.user.id, req.body);
  successResponse(res, data, data.message);
});

// POST /api/v1/kyc/documents/:type — Upload ID docs
// type: id_front | id_back | selfie
router.post('/documents/:type', authenticate, upload.single('document'), async (req, res) => {
  const { type } = req.params;
  const allowed = ['id_front', 'id_back', 'selfie'];
  if (!allowed.includes(type)) throw ApiError.badRequest('Invalid document type');
  if (!req.file) throw ApiError.badRequest('No document uploaded');

  const url = await kycService.uploadKycDocument(req.user.id, req.file, type);
  successResponse(res, { url }, 'Document uploaded');
});

// POST /api/v1/kyc/webhook — Dojah async verification callback
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(200).json({ received: true });
  }
  const result = await kycService.handleDojahWebhook(payload);
  res.status(200).json(result);
});

// ── Admin routes ───────────────────────────────

// GET /api/v1/kyc/admin/pending
router.get('/admin/pending', authenticate, authorize('ADMIN'), async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const { records, total } = await kycService.listPendingKyc({ page, limit, status });
  paginatedResponse(res, records, paginate(page, limit, total));
});

// PATCH /api/v1/kyc/admin/:userId/review
router.patch('/admin/:userId/review', authenticate, authorize('ADMIN'), async (req, res) => {
  const { action, rejectionReason, tierUpgrade } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    throw ApiError.badRequest('action must be "approve" or "reject"');
  }
  const data = await kycService.adminReviewKyc(req.user.id, req.params.userId, { action, rejectionReason, tierUpgrade });
  successResponse(res, data, `KYC ${data.status.toLowerCase()}`);
});

module.exports = router;
