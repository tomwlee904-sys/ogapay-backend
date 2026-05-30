'use strict';

const express = require('express');
const { validate, registerSchema, loginSchema, refreshTokenSchema } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth.middleware');
const authService = require('../services/auth.service');
const { successResponse, createdResponse } = require('../utils/apiResponse');

const router = express.Router();

const normalizeRegisterBody = (req, res, next) => {
  const body = req.body || {};
  req.body = {
    ...body,
    firstName: body.firstName || body.first_name || String(body.full_name || '').trim().split(/\s+/)[0],
    lastName: body.lastName || body.last_name || String(body.full_name || '').trim().split(/\s+/).slice(1).join(' '),
    referralCode: body.referralCode || body.referral_code,
    role: String(body.role || 'WORKER').toUpperCase(),
  };
  next();
};

// POST /api/v1/auth/register
router.post('/register', normalizeRegisterBody, validate(registerSchema), async (req, res) => {
  const result = await authService.register(req.body);
  createdResponse(res, result, 'Account created successfully');
});

// POST /api/v1/auth/signup - frontend/spec alias
router.post('/signup', normalizeRegisterBody, validate(registerSchema), async (req, res) => {
  const result = await authService.register(req.body);
  createdResponse(res, result, 'Account created successfully');
});

// POST /api/v1/auth/google/exchange
router.post('/google/exchange', async (req, res) => {
  const result = await authService.googleExchange(
    {
      supabaseAccessToken: req.body?.supabaseAccessToken || req.body?.access_token,
      role: req.body?.role,
    },
    req.ip,
    req.headers['user-agent'],
  );
  successResponse(res, result, 'Google sign-in successful');
});

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  const result = await authService.login(
    req.body,
    req.ip,
    req.headers['user-agent'],
  );
  successResponse(res, result, 'Login successful');
});

// POST /api/v1/auth/refresh
router.post('/refresh', validate(refreshTokenSchema), async (req, res) => {
  const result = await authService.refreshTokens(req.body.refreshToken);
  successResponse(res, result, 'Tokens refreshed');
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await authService.logout(req.user.id, req.body.refreshToken);
  successResponse(res, null, 'Logged out successfully');
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res) => {
  successResponse(res, req.user, 'User fetched');
});


// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  successResponse(res, result);
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.newPassword);
  successResponse(res, result);
});

module.exports = router;
