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

// ─── Twitter/X OAuth ─────────────────────────────

// POST /api/v1/social/twitter/init
router.post('/twitter/init', authenticate, async (req, res) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) return res.status(500).json({ success: false, message: 'Twitter OAuth not configured' });

  const state = require('crypto').randomBytes(16).toString('hex');
  const codeVerifier = require('crypto').randomBytes(32).toString('base64url');
  const callbackUrl = process.env.TWITTER_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/twitter/callback`;

  const codeChallenge = require('crypto').createHash('sha256').update(codeVerifier).digest('base64url');

  oauthStore.set(state, { userId: req.user.id, codeVerifier, ts: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'tweet.read users.read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  successResponse(res, { authUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}` });
});

// GET /api/v1/social/twitter/callback
router.get('/twitter/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND()}/settings?twitter=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings?twitter=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings?twitter=error&message=invalid_state`);
  oauthStore.delete(state);

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const callbackUrl = process.env.TWITTER_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/twitter/callback`;

  let tokenData;
  try {
    const axios = require('axios');
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await axios.post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      code_verifier: stored.codeVerifier,
    }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
    });
    tokenData = tokenRes.data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    return res.redirect(`${FRONTEND()}/settings?twitter=error&message=${encodeURIComponent(msg)}`);
  }

  let twitterUser;
  try {
    const axios = require('axios');
    const userRes = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    twitterUser = userRes.data?.data;
  } catch {
    twitterUser = null;
  }

  await prisma.user.update({
    where: { id: stored.userId },
    data: {
      twitterOAuthToken: tokenData.access_token,
      twitterOAuthUserId: twitterUser?.id || null,
      twitterOAuthHandle: twitterUser?.username || null,
      twitterOAuthConnected: true,
      twitterUsername: twitterUser?.username || undefined,
      twitterId: twitterUser?.id || undefined,
    },
  });

  res.redirect(`${FRONTEND()}/dashboard?twitter=connected`);
});

// GET /api/v1/social/twitter/status
router.get('/twitter/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { twitterOAuthConnected: true, twitterOAuthHandle: true, twitterOAuthUserId: true },
  });
  successResponse(res, {
    connected: user?.twitterOAuthConnected || false,
    handle: user?.twitterOAuthHandle || null,
    userId: user?.twitterOAuthUserId || null,
  });
});

// DELETE /api/v1/social/twitter/disconnect
router.delete('/twitter/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      twitterOAuthToken: null, twitterOAuthUserId: null,
      twitterOAuthHandle: null, twitterOAuthConnected: false,
    },
  });
  successResponse(res, null, 'Twitter disconnected');
});

// ─── Google OAuth ────────────────────────────────

// POST /api/v1/social/google/init
router.post('/google/init', authenticate, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ success: false, message: 'Google OAuth not configured' });

  const state = require('crypto').randomBytes(16).toString('hex');
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/google/callback`;

  oauthStore.set(state, { userId: req.user.id, ts: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    state,
  });

  successResponse(res, { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

// GET /api/v1/social/google/callback
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND()}/settings?google=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings?google=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings?google=error&message=invalid_state`);
  oauthStore.delete(state);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/v1/social/google/callback`;

  let tokenData;
  try {
    const axios = require('axios');
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    tokenData = tokenRes.data;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    return res.redirect(`${FRONTEND()}/settings?google=error&message=${encodeURIComponent(msg)}`);
  }

  let googleUser;
  try {
    const axios = require('axios');
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    googleUser = userRes.data;
  } catch {
    googleUser = null;
  }

  await prisma.user.update({
    where: { id: stored.userId },
    data: {
      googleOAuthToken: tokenData.access_token,
      googleOAuthRefreshToken: tokenData.refresh_token || null,
      googleOAuthTokenExpiry: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
      googleOAuthUserId: googleUser?.sub || null,
      googleOAuthHandle: googleUser?.email || googleUser?.name || null,
      googleOAuthConnected: true,
    },
  });

  res.redirect(`${FRONTEND()}/dashboard?google=connected`);
});

// GET /api/v1/social/google/status
router.get('/google/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { googleOAuthConnected: true, googleOAuthHandle: true, googleOAuthUserId: true },
  });
  successResponse(res, {
    connected: user?.googleOAuthConnected || false,
    handle: user?.googleOAuthHandle || null,
    userId: user?.googleOAuthUserId || null,
  });
});

// DELETE /api/v1/social/google/disconnect
router.delete('/google/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      googleOAuthToken: null, googleOAuthRefreshToken: null,
      googleOAuthTokenExpiry: null, googleOAuthUserId: null,
      googleOAuthHandle: null, googleOAuthConnected: false,
    },
  });
  successResponse(res, null, 'Google disconnected');
});

// ─── Telegram OAuth ──────────────────────────────

// POST /api/v1/social/telegram/init
router.post('/telegram/init', authenticate, async (req, res) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) return res.status(500).json({ success: false, message: 'Telegram bot not configured' });

  const state = require('crypto').randomBytes(16).toString('hex');
  oauthStore.set(state, { userId: req.user.id, ts: Date.now() });

  // Telegram uses a deep link for bot-based auth
  const deepLink = `https://t.me/${botUsername}?start=${state}`;

  successResponse(res, { authUrl: deepLink, state });
});

// GET /api/v1/social/telegram/callback?state=...&id=...&username=...
router.get('/telegram/callback', async (req, res) => {
  const { state, id, username, first_name, last_name, photo_url, auth_date, hash } = req.query;

  if (!state || !id) return res.redirect(`${FRONTEND()}/settings?telegram=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings?telegram=error&message=invalid_state`);
  oauthStore.delete(state);

  // Verify the hash if bot token is available (Telegram login widget verification)
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && hash) {
    const crypto = require('crypto');
    const checkString = Object.entries({ auth_date, first_name, id, last_name, photo_url, username })
      .filter(([, v]) => v != null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
    if (computedHash !== hash) {
      return res.redirect(`${FRONTEND()}/settings?telegram=error&message=invalid_hash`);
    }
  }

  await prisma.user.update({
    where: { id: stored.userId },
    data: {
      telegramOAuthChatId: String(id),
      telegramOAuthHandle: username || null,
      telegramOAuthConnected: true,
      telegram: username || undefined,
    },
  });

  res.redirect(`${FRONTEND()}/dashboard?telegram=connected`);
});

// GET /api/v1/social/telegram/status
router.get('/telegram/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { telegramOAuthConnected: true, telegramOAuthHandle: true, telegramOAuthChatId: true },
  });
  successResponse(res, {
    connected: user?.telegramOAuthConnected || false,
    handle: user?.telegramOAuthHandle || null,
    chatId: user?.telegramOAuthChatId || null,
  });
});

// DELETE /api/v1/social/telegram/disconnect
router.delete('/telegram/disconnect', authenticate, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      telegramOAuthChatId: null, telegramOAuthHandle: null,
      telegramOAuthConnected: false,
    },
  });
  successResponse(res, null, 'Telegram disconnected');
});

module.exports = router;
