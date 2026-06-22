'use strict';

const express = require('express');
const { validate, registerSchema, loginSchema, refreshTokenSchema } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const authService = require('../services/auth.service');
const { successResponse, createdResponse } = require('../utils/apiResponse');
const { supabase } = require('../config/supabase');

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

// GET /api/v1/auth/google — redirect to Google OAuth via Supabase
router.get('/google', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'https://ogapay.vercel.app'}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    res.redirect(data.url);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
  }
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

// POST /api/v1/auth/setup-2fa — Generate TOTP secret and QR code
router.post('/setup-2fa', authenticate, async (req, res) => {
  const result = await authService.setup2FA(req.user.id);
  successResponse(res, result, 'Scan the QR code with your authenticator app');
});

// POST /api/v1/auth/verify-2fa — Verify TOTP code and enable 2FA
router.post('/verify-2fa', authenticate, async (req, res) => {
  const result = await authService.verify2FA(req.user.id, req.body.token);
  successResponse(res, result, result.message);
});

// POST /api/v1/auth/disable-2fa — Disable 2FA (requires current TOTP code)
router.post('/disable-2fa', authenticate, async (req, res) => {
  const result = await authService.disable2FA(req.user.id, req.body.token);
  successResponse(res, result, result.message);
});

// POST /api/v1/auth/2fa-challenge — Complete login with 2FA code
router.post('/2fa-challenge', async (req, res) => {
  const result = await authService.verify2FALogin(req.body.twoFactorToken, req.body.token);
  successResponse(res, result, 'Login successful');
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        kyc: { select: { status: true } },
        wallets: {
          select: { balance: true, currency: true, lockedBalance: true, isActive: true },
        },
        _count: {
          select: { taskSubmissions: true, tasksCreated: true, referrals: true },
        },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const walletMap = {};
    if (user.wallets) {
      for (const w of user.wallets) {
        walletMap[w.currency] = { balance: Number(w.balance), pendingWithdrawals: Number(w.lockedBalance) };
      }
    }
    const bankAccount = user.bankAccount ? { accountNumber: user.bankAccount, bankName: user.bankName } : null;
    const onboarding = {
      profileComplete: !!(user.firstName && user.lastName && user.avatarUrl),
      emailVerified: user.isEmailVerified,
      walletConnected: !!user.walletAddress,
      bankAdded: !!user.bankAccount,
      allComplete: !!(user.firstName && user.lastName && user.isEmailVerified && user.walletAddress),
    };
    const { wallets, kyc, passwordHash, ...safeUser } = user;
    const response = {
      id: safeUser.id, email: safeUser.email, firstName: safeUser.firstName,
      lastName: safeUser.lastName, username: safeUser.username,
      avatar: safeUser.avatarUrl, displayName: safeUser.firstName + ' ' + safeUser.lastName,
      bio: safeUser.workerProfileBio || null, role: safeUser.role,
      walletAddress: safeUser.walletAddress || null, walletProvider: safeUser.walletProvider || null,
      walletConnectedAt: safeUser.walletConnectedAt ? safeUser.walletConnectedAt.toISOString() : null,
      referralCode: safeUser.referralCode, isEmailVerified: safeUser.isEmailVerified,
      kycStatus: kyc?.status || null, onboardingComplete: safeUser.onboardingComplete || false,
      wallet: walletMap, bankAccount, onboarding, _count: user._count, createdAt: safeUser.createdAt,
    };
    return res.json({ success: true, user: response });
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
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

// POST /api/v1/auth/change-password
router.post("/change-password", authenticate, async (req, res) => {
  const result = await authService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  successResponse(res, result, result.message);
});


// POST /api/v1/auth/connect/:platform — OAuth account connection
const PLATFORM_POINTS = { linkedin: 10, twitter: 8, github: 8, google: 5, telegram: 5 };

router.post('/connect/:platform', authenticate, async (req, res) => {
  const { platform } = req.params;
  const { code, redirectUri } = req.body;
  
  if (!['linkedin', 'twitter', 'github', 'google', 'telegram'].includes(platform)) {
    throw require('../utils/apiResponse').ApiError.badRequest('Unsupported platform');
  }
  
  // In production, exchange the auth code for an access token using stored client_secret
  // Then fetch the user's profile from the platform's API
  // For now, mark the account as connected and update the score
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw require('../utils/apiResponse').ApiError.notFound('User not found');
  
  const currentAccounts = (user.connectedAccounts && typeof user.connectedAccounts === 'object')
    ? user.connectedAccounts
    : {};
  
  if (currentAccounts[platform]) {
    throw require('../utils/apiResponse').ApiError.conflict('Account already connected');
  }
  
  const updatedAccounts = { ...currentAccounts, [platform]: true };
  const scoreIncrease = PLATFORM_POINTS[platform] || 0;
  
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      connectedAccounts: updatedAccounts,
      ogaScore: { increment: scoreIncrease },
    },
  });
  
  require('../utils/apiResponse').successResponse(res, {
    connectedAccounts: updatedAccounts,
    ogaScore: (user.ogaScore || 0) + scoreIncrease,
  }, `${platform} connected successfully`);
});

// POST /api/v1/auth/wallet/connect — Connect Solana wallet address
router.post('/wallet/connect', authenticate, async (req, res) => {
  const { walletAddress, provider } = req.body;
  
  if (!walletAddress) {
    throw require('../utils/apiResponse').ApiError.badRequest('Wallet address is required');
  }
  
  // Check if wallet address is already used by another user
  const existing = await prisma.user.findFirst({
    where: { walletAddress, id: { not: req.user.id } },
  });
  
  if (existing) {
    throw require('../utils/apiResponse').ApiError.conflict('This wallet address is already connected to another account');
  }
  
  // Update user's wallet address
  await prisma.user.update({
    where: { id: req.user.id },
    data: { walletAddress },
  });
  
  require('../utils/apiResponse').successResponse(res, {
    walletAddress,
    provider: provider || 'phantom',
  }, 'Wallet connected successfully');
});

// POST /api/v1/auth/verify-email
router.post('/verify-email', async (req, res) => {
  const { token, userId } = req.body;
  if (!token || !userId) return res.status(400).json({ success: false, message: 'Missing token or userId' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.isEmailVerified) return res.json({ success: true, message: 'Email already verified' });
  if (user.emailVerificationToken !== token) return res.status(400).json({ success: false, message: 'Invalid token' });
  if (!user.emailVerificationTokenExpiry || user.emailVerificationTokenExpiry < new Date()) {
    return res.status(400).json({ success: false, message: 'Token expired. Request a new one.' });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiry: null,
    },
  });

  successResponse(res, null, 'Email verified successfully');
});

// POST /api/v1/auth/resend-verification
router.post('/resend-verification', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.isEmailVerified) return res.json({ success: true, message: 'Email already verified' });

  const authService = require('../services/auth.service');
  await authService.sendVerificationEmail(user);

  successResponse(res, null, 'Verification email sent');
});

module.exports = router;
