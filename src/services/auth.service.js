'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');
const { sendEmail, buildVerificationEmail } = require('./email.service');

const twoFactorService = require('./2fa.service');

const SALT_ROUNDS = 12;

async function sendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: token, emailVerificationTokenExpiry: expiry },
  });

  const frontend = process.env.FRONTEND_URL || 'https://ogapay.vercel.app';
  const link = `${frontend}/verify-email?token=${token}&userId=${user.id}`;
  const email = buildVerificationEmail({ name: user.firstName, link });

  return sendEmail({ to: user.email, ...email });
}

// Generate a short unique referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ── Register ────────────────────────────────────

const register = async ({ firstName, lastName, email, password, username, role, referralCode, phone }) => {
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { username } }),
  ]);

  if (existingEmail) throw ApiError.conflict('Email already registered');
  if (existingUsername) throw ApiError.conflict('Username already taken');

  // Validate referral code
  let referredById = null;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (!referrer) throw ApiError.badRequest('Invalid referral code');
    if (referrer.email === email) throw ApiError.badRequest('You cannot refer yourself');
    referredById = referrer.id;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const myReferralCode = generateReferralCode();

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        username,
        role,
        phone,
        referralCode: myReferralCode,
        referredById,
      },
    });

    // Create wallets
    const currencies = ['NGN', 'USDC', 'USDT', 'SOL'];
    await tx.wallet.createMany({
      data: currencies.map((currency) => ({
        userId: newUser.id,
        currency,
        balance: 0,
        lockedBalance: 0,
      })),
    });

    // Create role-specific profile
    if (role === 'WORKER') {
      await tx.workerProfile.create({ data: { userId: newUser.id } });
    } else if (role === 'POSTER') {
      await tx.posterProfile.create({ data: { userId: newUser.id } });
    }

    // Referral welcome notification
    if (referredById) {
      await tx.notification.create({
        data: {
          userId: referredById,
          type: 'REFERRAL_SIGNUP',
          title: '🎉 Your referral signed up!',
          body: `${firstName} joined OgaPay using your referral link.`,
          data: { referredUserId: newUser.id },
        },
      });
    }

    return newUser;
  });

  logger.info(`New user registered: ${user.email} (${user.role})`);

  // Fire-and-forget verification email (don't block registration)
  sendVerificationEmail(user).catch(e => logger.warn('Verification email failed:', e.message));

  const tokens = generateTokenPair(user);
  await saveRefreshToken(user.id, tokens.refreshToken);

  return { user: sanitizeUser(user), tokens };
};

// ── Login ──────────────────────────────────────

const login = async ({ email, password }, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { kyc: { select: { status: true } } },
  });

  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (user.isBanned) throw ApiError.forbidden('Account has been banned. Contact support.');
  if (!user.passwordHash) throw ApiError.badRequest('Please sign in with Google or reset your password');

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) throw ApiError.unauthorized('Invalid email or password');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  if (user.isTwoFactorEnabled) {
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const challengeExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.twoFactorChallenge.upsert({
      where: { userId: user.id },
      create: { userId: user.id, token: challengeToken, expiresAt: challengeExpiry },
      update: { token: challengeToken, expiresAt: challengeExpiry },
    });

    logger.info(`2FA required for user: ${user.email}`);
    return { requiresTwoFactor: true, challengeToken, userId: user.id };
  }

  const tokens = generateTokenPair(user);
  await saveRefreshToken(user.id, tokens.refreshToken, ipAddress, userAgent);

  logger.info(`User logged in: ${user.email}`);
  return { user: sanitizeUser(user), tokens };
};

// ── Refresh Tokens ─────────────────────────────

const refreshTokens = async (token) => {
  const decoded = verifyRefreshToken(token);

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.userId !== decoded.sub) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw ApiError.unauthorized('Refresh token expired. Please log in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user) throw ApiError.unauthorized('User not found');

  // Rotate refresh token
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = generateTokenPair(user);
  await saveRefreshToken(user.id, tokens.refreshToken);

  return { tokens };
};

// ── Google Exchange ────────────────────────────

const googleExchange = async ({ supabaseAccessToken, role }, ipAddress, userAgent) => {
  if (!supabaseAccessToken) throw ApiError.badRequest('Missing Supabase access token');

  let supabaseUser;
  try {
    const { data, error } = await supabase.auth.getUser(supabaseAccessToken);
    if (error) throw error;
    supabaseUser = data.user;
  } catch (err) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(supabaseAccessToken);
      if (error) throw error;
      supabaseUser = data.user;
    } catch (err2) {
      logger.error(`Supabase token verification failed (anon: ${err.message}, admin: ${err2.message})`);
      throw ApiError.unauthorized('Invalid or expired Supabase session');
    }
  }

  if (!supabaseUser?.email) throw ApiError.badRequest('No email returned from Google');

  const { email, user_metadata, id: supabaseId } = supabaseUser;
  const meta = user_metadata || {};
  const fullName = meta.full_name || meta.name || email.split('@')[0];
  const parts = fullName.trim().split(/\s+/);
  const firstName = meta.given_name || parts[0] || '';
  const lastName = meta.family_name || parts.slice(1).join(' ') || '';
  const avatarUrl = meta.avatar_url || meta.picture || null;

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    if (user.isBanned) throw ApiError.forbidden('Account has been banned. Contact support.');
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), avatarUrl: avatarUrl || undefined },
    });
    await prisma.kycVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, status: 'APPROVED' },
      update: { status: 'APPROVED' },
    });
    const existingWallets = await prisma.wallet.findMany({ where: { userId: user.id }, select: { currency: true } });
    const existingCurrencies = existingWallets.map(w => w.currency);
    const neededCurrencies = ['NGN', 'USDC', 'USDT', 'SOL'];
    const missing = neededCurrencies.filter(c => !existingCurrencies.includes(c));
    if (missing.length > 0) {
      await prisma.wallet.createMany({
        data: missing.map(currency => ({ userId: user.id, currency, balance: 0, lockedBalance: 0 })),
      });
    }
  } else {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: firstName || email.split('@')[0],
          lastName,
          email,
          username: email.split('@')[0] + '_' + supabaseId.slice(0, 6),
          role: role || 'POSTER',
          isEmailVerified: true,
          avatarUrl,
          referralCode: generateReferralCode(),
        },
      });

      const currencies = ['NGN', 'USDC', 'USDT', 'SOL'];
      await tx.wallet.createMany({
        data: currencies.map((currency) => ({
          userId: newUser.id,
          currency,
          balance: 0,
          lockedBalance: 0,
        })),
      });

      if (newUser.role === 'WORKER') {
        await tx.workerProfile.create({ data: { userId: newUser.id } });
      } else if (newUser.role === 'POSTER') {
        await tx.posterProfile.create({ data: { userId: newUser.id } });
      }

      await tx.kycVerification.create({ data: { userId: newUser.id, status: 'APPROVED' } });

      logger.info(`New user from Google: ${newUser.email} (${newUser.role})`);
      const newTokens = generateTokenPair(newUser);
      await saveRefreshToken(newUser.id, newTokens.refreshToken, ipAddress, userAgent);
      return { user: sanitizeUser(newUser), tokens: newTokens };
    });
  }

  const tokens = generateTokenPair(user);
  await saveRefreshToken(user.id, tokens.refreshToken, ipAddress, userAgent);

  return { user: sanitizeUser(user), tokens };
};

// ── Logout ─────────────────────────────────────

const logout = async (userId, refreshToken) => {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  // Optionally clear all sessions:
  // await prisma.refreshToken.deleteMany({ where: { userId } });
};

// ── Helpers ─────────────────────────────────────

const saveRefreshToken = async (userId, token, ipAddress, userAgent) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt, ipAddress, userAgent },
  });
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  username: user.username,
  avatarUrl: user.avatarUrl,
  role: user.role,
  referralCode: user.referralCode,
  isEmailVerified: user.isEmailVerified,
  isTwoFactorEnabled: user.isTwoFactorEnabled,
  createdAt: user.createdAt,
});


// ── Forgot Password ────────────────────────────

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal whether email exists
    return { message: 'If that email is registered, a reset link will be sent.' };
  }

  const resetToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Store reset token in DB
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: `reset_${resetToken}`,
      expiresAt,
    },
  });

  // In production, send email via SendGrid/Mailgun
  logger.info(`Password reset requested for ${email}. Token: ${resetToken}`);

  return { message: 'If that email is registered, a reset link will be sent.' };
};

// ── Reset Password ─────────────────────────────

const resetPassword = async (token, newPassword) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: `reset_${token}` },
    include: { user: true },
  });

  if (!stored) throw ApiError.badRequest('Invalid or expired reset token');
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw ApiError.badRequest('Reset token expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.delete({ where: { id: stored.id } }),
  ]);

  return { message: 'Password reset successful' };
};

// ── Change Password (authenticated) ────────────

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  if (!user.passwordHash) {
    // User signed up with Google — set password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: 'Password set successfully' };
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Invalidate all existing sessions
  await prisma.refreshToken.deleteMany({ where: { userId } });

  return { message: 'Password changed successfully' };
};

const verify2FAChallenge = async (userId, challengeToken, twoFactorCode) => {
  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { userId },
  });

  if (!challenge || challenge.token !== challengeToken) {
    throw ApiError.unauthorized('Invalid challenge');
  }

  if (challenge.expiresAt < new Date()) {
    await prisma.twoFactorChallenge.delete({ where: { id: challenge.id } });
    throw ApiError.unauthorized('Challenge expired. Please log in again.');
  }

  const isValid = await twoFactorService.verifyChallenge(userId, twoFactorCode);
  if (!isValid) {
    throw ApiError.unauthorized('Invalid 2FA code');
  }

  await prisma.twoFactorChallenge.delete({ where: { id: challenge.id } });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { kyc: { select: { status: true } } },
  });
  if (!user) throw ApiError.notFound('User not found');

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  const tokens = generateTokenPair(user);
  await saveRefreshToken(user.id, tokens.refreshToken);

  logger.info(`2FA challenge passed for user: ${user.email}`);
  return { user: sanitizeUser(user), tokens };
};

module.exports = { register, login, googleExchange, refreshTokens, logout, forgotPassword, resetPassword, changePassword, verify2FAChallenge };
