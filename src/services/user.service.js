'use strict';

const { prisma } = require('../config/database');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../utils/apiResponse');

// ── Get current user profile ───────────────────

// Settings preferences. Unknown keys are ignored and each value is type-checked,
// so the JSON column can't be filled with junk. "isPublic" lives in its own column.
const PREF_DEFAULTS = {
  emailNotifications: true, // master switch for email alerts
  taskAlerts: true,         // job updates (applications, approvals, rejections)
  payoutAlerts: true,       // money received
  communityAlerts: true,    // invites and join requests
  newTaskAlerts: false,     // daily email of new jobs in your categories
  weeklyDigest: false,      // Monday summary of what you earned
  loginAlerts: true,        // email when your account signs in on a new browser
  autoConvert: false,       // convert USDC earnings to NGN
  showEarnings: false,      // public profile / leaderboards
  showRank: false,          // OgaScore badge on public profile
  defaultCurrency: 'NGN',
};
const CURRENCY_MODES = ['NGN', 'USDC', 'USDT', 'SOL', 'BOTH'];

const effectivePreferences = (stored) => {
  const p = (stored && typeof stored === 'object' && !Array.isArray(stored)) ? stored : {};
  const out = {};
  for (const [k, d] of Object.entries(PREF_DEFAULTS)) {
    out[k] = typeof d === 'boolean' ? (typeof p[k] === 'boolean' ? p[k] : d) : (CURRENCY_MODES.includes(p[k]) ? p[k] : d);
  }
  return out;
};

// Merge a partial update into the saved preferences (never replace them wholesale;
// the display-currency switcher sends one key at a time and used to wipe the rest)
const updatePreferences = async (userId, incoming = {}) => {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw ApiError.badRequest('preferences object required');
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, isPublic: true } });
  if (!user) throw ApiError.notFound('User not found');
  const current = (user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)) ? user.preferences : {};
  const next = { ...current };
  for (const [k, v] of Object.entries(incoming)) {
    if (k === 'isPublic') continue;
    if (!(k in PREF_DEFAULTS)) continue;
    if (typeof PREF_DEFAULTS[k] === 'boolean') {
      if (typeof v !== 'boolean') throw ApiError.badRequest(`${k} must be true or false`);
      next[k] = v;
    } else if (k === 'defaultCurrency') {
      if (!CURRENCY_MODES.includes(v)) throw ApiError.badRequest('Unknown currency');
      next[k] = v;
    }
  }
  const data = { preferences: next };
  if (typeof incoming.isPublic === 'boolean') data.isPublic = incoming.isPublic;
  if (typeof incoming.emailNotifications === 'boolean') data.emailNotifications = incoming.emailNotifications;
  const saved = await prisma.user.update({ where: { id: userId }, data, select: { preferences: true, isPublic: true } });
  return { ...effectivePreferences(saved.preferences), isPublic: saved.isPublic };
};

const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      kyc: { select: { status: true, kycTier: true, verifiedAt: true, rejectionReason: true, idType: true } },
      wallets: { where: { isActive: true } },
      workerProfile: true,
      posterProfile: true,
      _count: { select: { tasksCreated: true, taskSubmissions: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');

  // Never send credentials or one-time tokens, even to the owner
  const {
    passwordHash, twoFactorSecret, twoFactorBackupCodes,
    passwordResetToken, passwordResetTokenExpiry,
    emailVerificationToken, emailVerificationTokenExpiry,
    // Third-party OAuth tokens are server-side only
    linkedinOAuthToken, linkedinOAuthRefreshToken, githubOAuthToken,
    twitterOAuthToken, twitterOAuthTokenSecret, googleOAuthToken, googleOAuthRefreshToken,
    ...safeUser
  } = user;
  const { computeOgaScore, syncOgaScore } = require('./ogascore.service');
  const score = computeOgaScore(user);
  if (score !== user.ogaScore) await syncOgaScore(userId);
  return {
    ...safeUser,
    ogaScore: score,
    hasPassword: !!passwordHash,
    preferences: effectivePreferences(user.preferences),
    // Accounts connected through OAuth (the old connectedAccounts JSON was never set by OAuth)
    connections: {
      linkedin: { connected: user.linkedinOAuthConnected, handle: user.linkedinOAuthHandle || null },
      twitter: { connected: user.twitterOAuthConnected, handle: user.twitterOAuthHandle || null },
      github: { connected: user.githubOAuthConnected, handle: user.githubOAuthHandle || null },
      google: { connected: user.googleOAuthConnected, handle: user.googleOAuthHandle || null },
      telegram: { connected: user.telegramOAuthConnected, handle: user.telegramOAuthHandle || null },
    },
  };
};

// ── Update profile ─────────────────────────────

const updateProfile = async (userId, updates) => {
  if (updates.preferences !== undefined) {
    await updatePreferences(userId, updates.preferences);
    updates = { ...updates };
    delete updates.preferences;
  }
  const allowed = ['firstName', 'lastName', 'phone', 'avatarUrl', 'coverUrl', 'username', 'twitter', 'telegram', 'discord', 'website', 'isPublic'];
  const data = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  // Worker-specific updates
  const workerFields = ['bio', 'skills', 'isAvailable', 'categories'];
  const hasWorkerUpdate = workerFields.some(f => updates[f] !== undefined);
  if (hasWorkerUpdate) {
    const workerData = {};
    for (const field of workerFields) {
      if (updates[field] !== undefined) {
        workerData[field] = updates[field];
      }
    }
    // Upsert to handle missing WorkerProfile
    await prisma.workerProfile.upsert({
      where: { userId },
      update: workerData,
      create: { userId, ...workerData },
    });
  }

  // Poster-specific updates
  if (updates.companyName !== undefined || updates.website !== undefined) {
    await prisma.posterProfile.updateMany({
      where: { userId },
      data: {
        ...(updates.companyName !== undefined && { companyName: updates.companyName }),
        ...(updates.website !== undefined && { website: updates.website }),
      },
    });
  }

  const selectFields = { id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true, coverUrl: true, username: true, role: true, preferences: true };
  if (Object.keys(data).length === 0) {
    return prisma.user.findUnique({ where: { id: userId }, select: selectFields });
  }
  return prisma.user.update({
    where: { id: userId },
    data,
    select: selectFields,
  });
};

// ── Upload avatar to Supabase Storage ──────────

const uploadAvatar = async (userId, file) => {
  const ext = file.mimetype.split('/')[1];
  const path = `avatars/${userId}/avatar.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from('public-assets')
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

  if (error) throw ApiError.internal('Failed to upload avatar');

  const { data } = supabaseAdmin.storage.from('public-assets').getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
  return { avatarUrl };
};

// ── Upload cover photo to Supabase Storage ──────

const uploadCover = async (userId, file) => {
  const ext = file.mimetype.split('/')[1];
  const path = `covers/${userId}/cover.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from('public-assets')
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

  if (error) throw ApiError.internal('Failed to upload cover');

  const { data } = supabaseAdmin.storage.from('public-assets').getPublicUrl(path);
  const coverUrl = `${data.publicUrl}?t=${Date.now()}`;

  await prisma.user.update({ where: { id: userId }, data: { coverUrl } });
  return { coverUrl };
};

// ── Get public profile by username ─────────────

// Public, unauthenticated: an explicit allow-list only. Never return the
// user row itself (it holds email, phone, bank details, 2FA secrets and
// password-reset tokens) or wallets.
const getPublicProfile = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      coverUrl: true,
      twitterUsername: true,
      website: true,
      role: true,
      ogaScore: true,
      isPublic: true,
      isBanned: true,
      preferences: true,
      humanVerifiedAt: true,
      workerProfileBio: true,
      createdAt: true,
      kyc: { select: { status: true, kycTier: true } },
      workerProfile: {
        select: {
          level: true, reputationScore: true, totalEarned: true, tasksCompleted: true,
          successRate: true, avgRating: true, totalRatings: true, skills: true,
          categories: true, bio: true, isAvailable: true,
        },
      },
      posterProfile: {
        select: { companyName: true, website: true, totalPosted: true, avgRating: true, totalRatings: true, isVerified: true },
      },
      _count: {
        select: {
          tasksCreated: true,
          taskSubmissions: true,
          communityMemberships: true,
          portfolioItems: true,
          storeItems: { where: { isActive: true } },
          blogPosts: { where: { isPublished: true } },
        },
      },
    },
  });
  if (!user || user.isBanned) throw ApiError.notFound('User not found');

  if (user.isPublic === false) {
    return { username: user.username, isPublic: false };
  }

  const { isBanned, kyc, humanVerifiedAt, workerProfileBio, workerProfile, preferences, ...rest } = user;
  const prefs = (preferences && typeof preferences === 'object') ? preferences : {};
  return {
    ...rest,
    bio: workerProfile?.bio || workerProfileBio || null,
    // Only the display switches; preferences is free-form and client-written
    preferences: { showEarnings: prefs.showEarnings === true, showRank: prefs.showRank === true },
    kycVerified: kyc?.status === 'APPROVED' && (kyc?.kycTier ?? 0) >= 1,
    humanVerified: !!humanVerifiedAt,
    // Earnings are shown only if the user opted in (Settings → show earnings)
    workerProfile: workerProfile && {
      ...workerProfile,
      totalEarned: prefs.showEarnings === true ? workerProfile.totalEarned : undefined,
    },
  };
};

// ── Get user's transaction history ────────────

const getTransactionHistory = async (userId, { page = 1, limit = 20, type, currency }) => {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...(type && { type }),
    ...(currency && { currency }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total };
};

// ── Get referral stats ─────────────────────────

const getReferralStats = async (userId) => {
  const [user, totalReferrals, rewardedReferrals, bonusSum] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } }),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
    prisma.transaction.aggregate({
      where: { userId, type: 'REFERRAL_BONUS', status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const getReferralTier = (count) => {
    if (count >= 20) return 'gold';
    if (count >= 10) return 'silver';
    if (count >= 5) return 'bronze';
    return null;
  };

  return {
    referralCode: user.referralCode,
    referralLink: `${process.env.FRONTEND_URL}/join?ref=${user.referralCode}`,
    totalReferrals,
    rewardedReferrals,
    referralTier: getReferralTier(rewardedReferrals),
    totalEarned: bonusSum._sum.amount || 0,
  };
};

// ── Get earnings ──────────────────────────────

const getEarnings = async (userId) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId, type: 'TASK_PAYMENT', status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });
  const totalEarned = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  return { transactions, totalEarned };
};

module.exports = {
  PREF_DEFAULTS,
  effectivePreferences,
  updatePreferences,
  getProfile,
  updateProfile,
  uploadAvatar,
  uploadCover,
  getPublicProfile,
  getTransactionHistory,
  getReferralStats,
  getEarnings,
};
