'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
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
  const { supabaseAdmin } = require('../config/supabase');

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

  // ── Create Supabase Auth user — triggers verification email automatically ──
  const { data: supabaseData, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
    },
  });

  if (supabaseError) {
    if (supabaseError.message?.toLowerCase().includes('already')) {
      throw ApiError.conflict('Email already registered');
    }
    logger.error('Supabase user creation error:', supabaseError);
    throw ApiError.internal('Could not create account. Please try again.');
  }

  const supabaseId = supabaseData.user.id;

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
        supabaseId,
        isEmailVerified: false,
      },
    });

    // Create wallets
    const currencies = ['NGN', 'USDC', 'USDT'];
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

  logger.info(`New user registered: ${user.email} (${user.role}) — verification email sent via Supabase`);

  // Don't return tokens yet — user must verify email first
  return {
    user: sanitizeUser(user),
    message: 'Account created. Please check your email to verify your account.',
    requiresVerification: true,
  };
};

const uniqueUsername = async (base) => {
  const cleaned = String(base || 'ogapay_user').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'ogapay_user';
  let candidate = cleaned;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${cleaned.slice(0, 24)}_${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const createUserDefaults = async (tx, userId, role) => {
  await tx.wallet.createMany({
    data: ['NGN', 'USDC', 'USDT'].map((currency) => ({
      userId,
      currency,
      balance: 0,
      lockedBalance: 0,
    })),
    skipDuplicates: true,
  });

  if (role === 'WORKER') {
    await tx.workerProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  } else if (role === 'POSTER') {
    await tx.posterProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  await tx.kycVerification.upsert({ where: { userId }, update: {}, create: { userId } });
};

const googleExchange = async ({ supabaseAccessToken, role = 'WORKER' }, ipAddress, userAgent) => {
  const { supabaseAdmin } = require('../config/supabase');
  const { data, error } = await supabaseAdmin.auth.getUser(supabaseAccessToken);

  if (error || !data?.user?.email) {
    throw ApiError.unauthorized('Invalid Google session. Please sign in again.');
  }

  const supabaseUser = data.user;
  const email = supabaseUser.email.toLowerCase();
  const metadata = supabaseUser.user_metadata || {};
  const resolvedRole = String(role || 'WORKER').toUpperCase() === 'POSTER' ? 'POSTER' : 'WORKER';

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { OR: [{ email }, { supabaseId: supabaseUser.id }] },
    });

    if (existing) {
      await createUserDefaults(tx, existing.id, existing.role);
      return tx.user.update({
        where: { id: existing.id },
        data: {
          supabaseId: existing.supabaseId || supabaseUser.id,
          avatarUrl: existing.avatarUrl || metadata.avatar_url || metadata.picture,
          isEmailVerified: true,
          lastLoginAt: new Date(),
        },
      });
    }

    const fullName = String(metadata.full_name || metadata.name || '').trim();
    const [firstFromName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    const firstName = metadata.given_name || firstFromName || 'OgaPay';
    const lastName = metadata.family_name || rest.join(' ') || 'User';
    const username = await uniqueUsername(metadata.preferred_username || email.split('@')[0]);

    const created = await tx.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email,
        firstName,
        lastName,
        username,
        role: resolvedRole,
        avatarUrl: metadata.avatar_url || metadata.picture,
        isEmailVerified: true,
        referralCode: generateReferralCode(),
        lastLoginAt: new Date(),
      },
    });

    await createUserDefaults(tx, created.id, resolvedRole);
    return created;
  });

  const tokens = generateTokenPair(user);
  await saveRefreshToken(user.id, tokens.refreshToken, ipAddress, userAgent);

  logger.info(`Google user signed in: ${user.email}`);
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

  // Block login if email not verified
  if (!user.isEmailVerified) {
    throw ApiError.forbidden('Please verify your email before signing in. Check your inbox for the verification link.');
  }

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

// ── Logout ─────────────────────────────────────

const logout = async (userId, refreshToken) => {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
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

// ── Forgot Password ────────────────────────────

const jwt = require('jsonwebtoken');

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }

  const resetToken = jwt.sign(
    { sub: user.id, email: user.email, purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;

  logger.info(`Password reset requested for ${user.email} — Reset URL: ${resetUrl}`);

  return {
    message: 'If an account exists with that email, a reset link has been sent.',
    resetUrl,
  };
};

const resetPassword = async (token, newPassword) => {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== 'password_reset') {
      throw new Error('Invalid token purpose');
    }
  } catch (err) {
    throw ApiError.badRequest('Invalid or expired reset token. Please request a new one.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw ApiError.badRequest('User not found.');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  logger.info(`Password reset completed for ${user.email}`);
  return { message: 'Password has been reset successfully. You can now log in with your new password.' };
};

module.exports = { register, googleExchange, login, refreshTokens, logout, forgotPassword, resetPassword };
