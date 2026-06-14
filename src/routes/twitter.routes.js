'use strict';

const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { ApiError, successResponse } = require('../utils/apiResponse');

const router = express.Router();

const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 'https://ogapay-production.up.railway.app/api/v1/twitter/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://ogapay.vercel.app';

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function generateCodeChallenge(verifier) {
  const digest = crypto.createHash('sha256').update(verifier).digest();
  return digest.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// POST /init — Start Twitter OAuth PKCE flow (requires auth)
router.post('/init', authenticate, async (req, res) => {
  const userId = req.user.id;
  const state = base64url(JSON.stringify({ userId, ts: Date.now() }));
  const codeVerifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store state + verifier in DB (expires 10 min)
  await prisma.twitterOAuthState.upsert({
    where: { id: state },
    update: { codeVerifier, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    create: { id: state, userId, codeVerifier, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'users.read tweet.read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  successResponse(res, { authUrl }, 'Twitter auth URL generated');
});

// GET /callback — Twitter OAuth callback (public)
router.get('/callback', async (req, res) => {
  const { code, state: stateParam, error } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/dashboard?twitter_error=denied`);
  }
  if (!code || !stateParam) {
    return res.redirect(`${FRONTEND_URL}/dashboard?twitter_error=invalid`);
  }

  // Look up the OAuth state record
  const oauthState = await prisma.twitterOAuthState.findUnique({
    where: { id: stateParam },
  });
  if (!oauthState || oauthState.expiresAt < new Date()) {
    return res.redirect(`${FRONTEND_URL}/dashboard?twitter_error=expired`);
  }

  // Exchange code for access token
  let accessToken;
  try {
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
        code_verifier: oauthState.codeVerifier,
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('No access token');
  } catch {
    return res.redirect(`${FRONTEND_URL}/dashboard?twitter_error=token`);
  }

  // Fetch Twitter user info
  let twitterId, twitterUsername;
  try {
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!userRes.ok) throw new Error('User fetch failed');
    const userData = await userRes.json();
    twitterId = userData.data?.id;
    twitterUsername = userData.data?.username;
    if (!twitterId) throw new Error('No user ID');
  } catch {
    return res.redirect(`${FRONTEND_URL}/dashboard?twitter_error=user`);
  }

  // Save Twitter connection to user
  await prisma.user.update({
    where: { id: oauthState.userId },
    data: { twitterId, twitterUsername },
  });

  // Clean up OAuth state
  await prisma.twitterOAuthState.delete({ where: { id: stateParam } }).catch(() => {});

  res.redirect(`${FRONTEND_URL}/dashboard?twitter=connected`);
});

module.exports = router;
