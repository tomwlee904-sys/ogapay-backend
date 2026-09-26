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
const { syncOgaScore } = require('../services/ogascore.service');

// GET /api/v1/social/providers — which connections are set up on this server
// (Settings only offers the ones that will work). No secrets are returned.
router.get('/providers', (req, res) => {
  const e = process.env;
  successResponse(res, {
    linkedin: !!(e.LINKEDIN_CLIENT_ID && e.LINKEDIN_CLIENT_SECRET),
    github: !!(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET),
    twitter: !!(e.TWITTER_CLIENT_ID && e.TWITTER_CLIENT_SECRET),
    google: !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    telegram: !!(e.TELEGRAM_BOT_TOKEN && /^\d+:/.test(e.TELEGRAM_BOT_TOKEN)),
    very: !!(e.VERY_CLIENT_ID && e.VERY_CLIENT_SECRET),
  });
});

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
  if (error) return res.redirect(`${FRONTEND()}/settings/connections?linkedin=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings/connections?linkedin=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings/connections?linkedin=error&message=invalid_state`);
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
    return res.redirect(`${FRONTEND()}/settings/connections?linkedin=error&message=${encodeURIComponent(msg)}`);
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

  await syncOgaScore(stored.userId);
  res.redirect(`${FRONTEND()}/settings/connections?linkedin=connected`);
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
  await syncOgaScore(req.user.id);
  successResponse(res, null, 'LinkedIn disconnected');
});

// ─── VeryAI human verification (Palm OAuth2 + PKCE) ─────────

const VERY_AUTHORIZE_URL = 'https://connect.very.org/oauth/authorize';
const VERY_TOKEN_URL = 'https://api.very.org/oauth2/token';
const VERY_USERINFO_URL = 'https://api.very.org/oauth2/userinfo';
const VERY_REDIRECT = () => process.env.VERY_REDIRECT_URI || `${FRONTEND()}/verify/callback`;

// POST /api/v1/social/very/init — returns the VeryAI URL to send the user to
router.post('/very/init', authenticate, async (req, res) => {
  const clientId = process.env.VERY_CLIENT_ID;
  if (!clientId || !process.env.VERY_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: 'Human verification is not available yet' });
  }

  const crypto = require('crypto');
  const state = crypto.randomBytes(16).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = VERY_REDIRECT();

  oauthStore.set(`very:${state}`, { userId: req.user.id, verifier, redirectUri, ts: Date.now() });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  successResponse(res, { authUrl: `${VERY_AUTHORIZE_URL}?${params.toString()}` });
});

// POST /api/v1/social/very/complete — the frontend callback page posts { code, state } here
router.post('/very/complete', authenticate, async (req, res) => {
  const { code, state } = req.body || {};
  if (!code || !state) return res.status(400).json({ success: false, message: 'Missing verification code' });

  const key = `very:${state}`;
  const stored = oauthStore.get(key);
  // The flow must be finished by the same signed-in user who started it
  if (!stored || stored.userId !== req.user.id || Date.now() - stored.ts > STORE_TTL) {
    return res.status(400).json({ success: false, message: 'Verification session expired. Please start again.' });
  }
  oauthStore.delete(key);

  const axios = require('axios');
  let sub;
  try {
    const tokenRes = await axios.post(VERY_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: stored.redirectUri,
      client_id: process.env.VERY_CLIENT_ID,
      client_secret: process.env.VERY_CLIENT_SECRET,
      code_verifier: stored.verifier,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });

    const userRes = await axios.get(VERY_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      timeout: 15000,
    });
    sub = userRes.data?.sub;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
    return res.status(502).json({ success: false, message: `VeryAI verification failed: ${msg}` });
  }
  if (!sub) return res.status(502).json({ success: false, message: 'VeryAI did not return a verified identity' });

  const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { veryUserId: true } });
  if (me?.veryUserId && me.veryUserId !== sub) {
    return res.status(409).json({ success: false, message: 'This account is already verified by a different person' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { veryUserId: sub, humanVerifiedAt: new Date() },
      select: { humanVerifiedAt: true },
    });
    await syncOgaScore(req.user.id);
    successResponse(res, { verified: true, verifiedAt: user.humanVerifiedAt }, 'Human verification complete');
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'This person has already verified another OgaPay account' });
    }
    throw err;
  }
});

// GET /api/v1/social/very/status
router.get('/very/status', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { humanVerifiedAt: true } });
  successResponse(res, {
    verified: !!user?.humanVerifiedAt,
    verifiedAt: user?.humanVerifiedAt || null,
    available: !!(process.env.VERY_CLIENT_ID && process.env.VERY_CLIENT_SECRET),
  });
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
  if (error) return res.redirect(`${FRONTEND()}/settings/connections?github=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings/connections?github=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings/connections?github=error&message=invalid_state`);
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
    return res.redirect(`${FRONTEND()}/settings/connections?github=error&message=${encodeURIComponent(msg)}`);
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

  await syncOgaScore(stored.userId);
  res.redirect(`${FRONTEND()}/settings/connections?github=connected`);
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
  await syncOgaScore(req.user.id);
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
  if (error) return res.redirect(`${FRONTEND()}/settings/connections?twitter=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings/connections?twitter=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings/connections?twitter=error&message=invalid_state`);
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
    return res.redirect(`${FRONTEND()}/settings/connections?twitter=error&message=${encodeURIComponent(msg)}`);
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

  await syncOgaScore(stored.userId);
  res.redirect(`${FRONTEND()}/settings/connections?twitter=connected`);
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
  await syncOgaScore(req.user.id);
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
  if (error) return res.redirect(`${FRONTEND()}/settings/connections?google=error&message=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${FRONTEND()}/settings/connections?google=error&message=missing_params`);

  const stored = oauthStore.get(state);
  if (!stored) return res.redirect(`${FRONTEND()}/settings/connections?google=error&message=invalid_state`);
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
    return res.redirect(`${FRONTEND()}/settings/connections?google=error&message=${encodeURIComponent(msg)}`);
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

  await syncOgaScore(stored.userId);
  res.redirect(`${FRONTEND()}/settings/connections?google=connected`);
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
  await syncOgaScore(req.user.id);
  successResponse(res, null, 'Google disconnected');
});

// ─── Telegram OAuth ──────────────────────────────

// POST /api/v1/social/telegram/init
// Telegram login (oauth.telegram.org). Telegram signs the result with our bot
// token; the old callback skipped that check whenever no hash was sent, so
// anyone could attach any Telegram username to their account.
const telegramBotId = () => (process.env.TELEGRAM_BOT_TOKEN || '').split(':')[0];

function checkTelegramAuth(auth) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !auth || typeof auth !== 'object' || !auth.hash || !auth.id || !auth.auth_date) return 'invalid';
  const crypto = require('crypto');
  const fields = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username'];
  const checkString = fields
    .filter((k) => auth[k] != null && auth[k] !== '')
    .map((k) => `${k}=${auth[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  const given = String(auth.hash);
  if (computed.length !== given.length || !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(given))) return 'invalid_hash';
  if (Date.now() / 1000 - Number(auth.auth_date) > 86400) return 'expired';
  return null;
}

async function saveTelegram(userId, auth) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramOAuthChatId: String(auth.id),
      telegramOAuthHandle: auth.username || null,
      telegramOAuthConnected: true,
    },
  });
  await syncOgaScore(userId);
}

router.post('/telegram/init', authenticate, async (req, res) => {
  const botId = telegramBotId();
  if (!process.env.TELEGRAM_BOT_TOKEN || !/^\d+$/.test(botId)) {
    return res.status(503).json({ success: false, message: 'Telegram connection is not available yet' });
  }
  const state = require('crypto').randomBytes(16).toString('hex');
  oauthStore.set(`tg:${state}`, { userId: req.user.id, ts: Date.now() });
  const origin = new URL(FRONTEND()).origin;
  const returnTo = `${FRONTEND()}/settings/connections?telegram=callback&state=${state}`;
  const params = new URLSearchParams({ bot_id: botId, origin, embed: '0', request_access: 'write', return_to: returnTo });
  successResponse(res, { authUrl: `https://oauth.telegram.org/auth?${params.toString()}`, state });
});

// POST /api/v1/social/telegram/complete — Settings posts Telegram's signed result here
router.post('/telegram/complete', authenticate, async (req, res) => {
  const { state, auth } = req.body || {};
  const stored = state && oauthStore.get(`tg:${state}`);
  if (!stored || stored.userId !== req.user.id) {
    return res.status(400).json({ success: false, message: 'This Telegram sign-in has expired. Please try again.' });
  }
  const problem = checkTelegramAuth(auth);
  if (problem) return res.status(400).json({ success: false, message: "Telegram couldn't confirm your account. Please try again." });
  oauthStore.delete(`tg:${state}`);
  await saveTelegram(req.user.id, auth);
  successResponse(res, { connected: true, handle: auth.username || null }, 'Telegram connected');
});

// GET /api/v1/social/telegram/callback?state=...&id=...&hash=... (login widget redirect)
router.get('/telegram/callback', async (req, res) => {
  const { state } = req.query;
  const stored = state && oauthStore.get(`tg:${state}`);
  if (!stored) return res.redirect(`${FRONTEND()}/settings/connections?telegram=error&message=invalid_state`);
  const problem = checkTelegramAuth(req.query);
  if (problem) return res.redirect(`${FRONTEND()}/settings/connections?telegram=error&message=${problem}`);
  oauthStore.delete(`tg:${state}`);
  await saveTelegram(stored.userId, req.query);
  res.redirect(`${FRONTEND()}/settings/connections?telegram=connected`);
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
  await syncOgaScore(req.user.id);
  successResponse(res, null, 'Telegram disconnected');
});

module.exports = router;
