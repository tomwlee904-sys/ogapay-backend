'use strict';

const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth.middleware');
const userService = require('../services/user.service');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/v1/users/profile
router.get('/profile', authenticate, async (req, res) => {
  const data = await userService.getProfile(req.user.id);
  successResponse(res, data, 'Profile fetched');
});

// PATCH /api/v1/users/profile
router.patch('/profile', authenticate, async (req, res) => {
  const data = await userService.updateProfile(req.user.id, req.body);
  successResponse(res, data, 'Profile updated');
});

// POST /api/v1/users/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  if (!req.file) throw require('../utils/apiResponse').ApiError.badRequest('No file uploaded');
  const data = await userService.uploadAvatar(req.user.id, req.file);
  successResponse(res, data, 'Avatar updated');
});

// GET /api/v1/users/:username
router.get('/:username', async (req, res) => {
  const data = await userService.getWorkerPublicProfile(req.params.username);
  successResponse(res, data, 'Profile fetched');
});

// GET /api/v1/users/transactions/history
router.get('/transactions/history', authenticate, async (req, res) => {
  const { page = 1, limit = 20, type, currency } = req.query;
  const { transactions, total } = await userService.getTransactionHistory(
    req.user.id, { page, limit, type, currency }
  );
  paginatedResponse(res, transactions, paginate(page, limit, total));
});

// GET /api/v1/users/referrals/stats
router.get('/referrals/stats', authenticate, async (req, res) => {
  const data = await userService.getReferralStats(req.user.id);
  successResponse(res, data, 'Referral stats fetched');
});

module.exports = router;
