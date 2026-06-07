'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { supabaseAdmin } = require('../config/supabase');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const SALT_ROUNDS = 12;

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

    // Create KYC record
    await tx.kycVerification.create({ data: { userId: newUser.id } });

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
    const { data, error } = await supabaseAdmin.auth.getUser(supabaseAccessToken);
    if (error) throw error;
    supabaseUser = data.user;
  } catch (err) {
    logger.error(`Supabase token verification failed: ${err.message}`);
    throw ApiError.unauthorized('Invalid or expired Supabase session');
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
  } else {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: firstName || email.split('@')[0],
          lastName,
          email,
          username: email.split('@')[0] + '_' + supabaseId.slice(0, 6),
          role: role || 'WORKER',
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

      await tx.kycVerification.create({ data: { userId: newUser.id } });

      logger.info(`New user from Google: ${newUser.email} (${newUser.role})`);
      return newUser;
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
  createdAt: user.createdAt,
});

module.exports = { register, login, googleExchange, refreshTokens, logout };
