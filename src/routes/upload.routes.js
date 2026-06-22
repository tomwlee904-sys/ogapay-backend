'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError, createdResponse } = require('../utils/apiResponse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/proof', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${req.user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabaseAdmin.storage
    .from(process.env.SUPABASE_PROOF_BUCKET || 'task-proofs')
    .upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) throw ApiError.internal('Failed to upload proof');
  const { data } = supabaseAdmin.storage
    .from(process.env.SUPABASE_PROOF_BUCKET || 'task-proofs')
    .getPublicUrl(key);
  createdResponse(res, { url: data.publicUrl, path: key }, 'Proof uploaded');
});

// POST /uploads/store — Upload product image for store
router.post('/store', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `store/${req.user.id}/${Date.now()}-${safeName}`;
  const bucket = process.env.SUPABASE_STORE_BUCKET || 'task-proofs';
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) throw ApiError.internal('Failed to upload image');
  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(key);
  createdResponse(res, { url: data.publicUrl, path: key }, 'Image uploaded');
});


// POST /uploads/community — Upload community cover image
router.post('/community', authenticate, upload.single('cover'), async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `community/${req.user.id}/${Date.now()}-${safeName}`;
  const bucket = process.env.SUPABASE_STORE_BUCKET || 'task-proofs';
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) throw ApiError.internal('Failed to upload cover');
  const { data } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(key);
  createdResponse(res, { url: data.publicUrl, path: key }, 'Cover uploaded');
});

// POST /uploads/kyc — Upload KYC document (fallback for frontend upload.ts)
router.post('/kyc', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const docType = req.body.type || 'id_front';
  const allowed = ['id_front', 'id_back', 'selfie'];
  if (!allowed.includes(docType)) throw ApiError.badRequest('Invalid document type');

  const kycService = require('../services/kyc.service');
  const url = await kycService.uploadKycDocument(req.user.id, req.file, docType);
  createdResponse(res, { url }, 'KYC document uploaded');
});

module.exports = router;
