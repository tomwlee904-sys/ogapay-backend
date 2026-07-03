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

// Helper: get Twitter app-only Bearer Token from client credentials
let _cachedBearerToken = null;
let _tokenExpiresAt = 0;

async function getTwitterBearerToken() {
  // Check env var first
  if (process.env.TWITTER_BEARER_TOKEN) return process.env.TWITTER_BEARER_TOKEN;
  // Check cache
  if (_cachedBearerToken && Date.now() < _tokenExpiresAt) return _cachedBearerToken;
  // Obtain via OAuth 2.0 Client Credentials
  if (!process.env.TWITTER_CLIENT_ID || !process.env.TWITTER_CLIENT_SECRET) return null;
  try {
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(
          process.env.TWITTER_CLIENT_ID + ':' + process.env.TWITTER_CLIENT_SECRET
        ).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    _cachedBearerToken = data.access_token;
    _tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000 - 60000; // 1min buffer
    return _cachedBearerToken;
  } catch { return null; }
}

// POST /fetch-post — Fetch an X/Twitter post by URL
router.post('/fetch-post', authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) throw ApiError.badRequest('Post URL is required');

  // Parse tweet ID from URL
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  if (!match) throw ApiError.badRequest('Invalid X/Twitter URL');

  const tweetId = match[1];

  try {
    const bearerToken = await getTwitterBearerToken();
    if (!bearerToken) {
      return successResponse(res, {
        id: tweetId, url,
        authorName: 'Unknown', authorUsername: 'unknown',
        avatarUrl: null, text: '', media: [],
        likes: 0, reposts: 0, replies: 0, verified: false,
      }, 'Twitter API not configured');
    }

    const tweetRes = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?expansions=author_id,attachments.media_keys&media.fields=url,preview_image_url,type&tweet.fields=public_metrics,created_at&user.fields=profile_image_url,verified,username`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );

    if (!tweetRes.ok) throw new Error('Twitter API error');

    const tweetData = await tweetRes.json();
    const tweet = tweetData.data || {};
    const includes = tweetData.includes || {};
    const author = includes.users?.[0] || {};
    const mediaItems = includes.media || [];

    successResponse(res, {
      id: tweet.id, url,
      authorName: author.name || 'Unknown',
      authorUsername: author.username || 'unknown',
      avatarUrl: author.profile_image_url || null,
      verified: author.verified || false,
      text: tweet.text || '',
      media: mediaItems.map((m) => m.url || m.preview_image_url || '').filter(Boolean),
      likes: tweet.public_metrics?.like_count || 0,
      reposts: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
      createdAt: tweet.created_at || null,
    }, 'Tweet fetched successfully');

  } catch {
    successResponse(res, {
      id: tweetId, url,
      authorName: 'Unknown', authorUsername: 'unknown',
      avatarUrl: null, text: '', media: [],
      likes: 0, reposts: 0, replies: 0, verified: false,
    }, 'Could not fetch tweet data');
  }
});
