'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse } = require('../utils/apiResponse');
const { prisma } = require('../config/database');

const router = express.Router();

// ─── Shared helpers ──────────────────────────────

const oauthStore = new Map();
const STORE_TTL = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStore) {
    if (now - val.ts > STORE_TTL) oauthStore.delete(key);
  }
}, 60_000);

const FRONTEND = () => process.env.FRONTEND_URL || 'https://ogapay.vercel.app';

// ─── LinkedIn OAuth ──────────────────────────────

// POST /api/v1/social/linkedin/init
router.post('/linkedin/init', authenticate, async (req, res) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) return res.status(500).json({ success: false, message: 'LinkedIn OAuth not configured' });

  const state = require('crypto').randomBytes(16).toString('hex');
  const callbackUrl = process.env.LINKEDIN_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/linkedin/callback`;

  oauthStore.set(state, { userId: req.user.id, ts: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'openid profile email',
    state,
  });

  successResponse(res, { authUrl: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}` });
});

// GET /api/v1/social/linkedin/callback
router.get('/linkedin/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND()}/settings?linkedin=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings?linkedin=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings?linkedin=error&message=invalid_state`);
  oauthStore.delete(state);

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const callbackUrl = process.env.LINKEDIN_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/linkedin/callback`;

  let tokenData;
  try {
    const axios = require('axios');
    const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: clientId,
        client_secret: clientSecret,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    tokenData = tokenRes.data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    return res.redirect(`${FRONTEND()}/settings?linkedin=error&message=${encodeURIComponent(msg)}`);
  }

  let linkedinUser;
  try {
    const axios = require('axios');
    const userRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    linkedinUser = userRes.data;
  } catch {
    linkedinUser = null;
  }

  await prisma.user.update({
    where: { id: stored.userId },
    data: {
      linkedinOAuthToken: tokenData.access_token,
      linkedinOAuthRefreshToken: tokenData.refresh_token || null,
      linkedinOAuthTokenExpiry: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
      linkedinOAuthUserId: linkedinUser?.sub || null,
      linkedinOAuthHandle: linkedinUser?.name || linkedinUser?.email || null,
      linkedinOAuthConnected: true,
    },
  });

  res.redirect(`${FRONTEND()}/dashboard?linkedin=connected`);
});

// GET /api/v1/social/linkedin/status
router.get('/linkedin/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { linkedinOAuthConnected: true, linkedinOAuthHandle: true, linkedinOAuthUserId: true },
  });
  successResponse(res, {
    connected: user?.linkedinOAuthConnected || false,
    handle: user?.linkedinOAuthHandle || null,
    userId: user?.linkedinOAuthUserId || null,
  });
});

// DELETE /api/v1/social/linkedin/disconnect
router.delete('/linkedin/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      linkedinOAuthToken: null, linkedinOAuthRefreshToken: null,
      linkedinOAuthTokenExpiry: null, linkedinOAuthUserId: null,
      linkedinOAuthHandle: null, linkedinOAuthConnected: false,
    },
  });
  successResponse(res, null, 'LinkedIn disconnected');
});

// ─── GitHub OAuth ────────────────────────────────

// POST /api/v1/social/github/init
router.post('/github/init', authenticate, async (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ success: false, message: 'GitHub OAuth not configured' });

  const state = require('crypto').randomBytes(16).toString('hex');
  const callbackUrl = process.env.GITHUB_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/github/callback`;

  oauthStore.set(state, { userId: req.user.id, ts: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user',
    state,
  });

  successResponse(res, { authUrl: `https://github.com/login/oauth/authorize?${params.toString()}` });
});

// GET /api/v1/social/github/callback
router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND()}/settings?github=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings?github=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings?github=error&message=invalid_state`);
  oauthStore.delete(state);

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/github/callback`;

  let tokenData;
  try {
    const axios = require('axios');
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }, {
      headers: { Accept: 'application/json' },
    });
    tokenData = tokenRes.data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    return res.redirect(`${FRONTEND()}/settings?github=error&message=${encodeURIComponent(msg)}`);
  }

  let githubUser;
  try {
    const axios = require('axios');
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    githubUser = userRes.data;
  } catch {
    githubUser = null;
  }

  await prisma.user.update({
    where: { id: stored.userId },
    data: {
      githubOAuthToken: tokenData.access_token,
      githubOAuthUserId: String(githubUser?.id || ''),
      githubOAuthHandle: githubUser?.login || null,
      githubOAuthConnected: true,
    },
  });

  res.redirect(`${FRONTEND()}/dashboard?github=connected`);
});

// GET /api/v1/social/github/status
router.get('/github/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { githubOAuthConnected: true, githubOAuthHandle: true, githubOAuthUserId: true },
  });
  successResponse(res, {
    connected: user?.githubOAuthConnected || false,
    handle: user?.githubOAuthHandle || null,
    userId: user?.githubOAuthUserId || null,
  });
});

// DELETE /api/v1/social/github/disconnect
router.delete('/github/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      githubOAuthToken: null, githubOAuthUserId: null,
      githubOAuthHandle: null, githubOAuthConnected: false,
    },
  });
  successResponse(res, null, 'GitHub disconnected');
});

module.exports = router;
