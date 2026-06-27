'use strict';

const { prisma } = require('../config/database');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../utils/apiResponse');

// ── Get current user profile ───────────────────

const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      kyc: { select: { status: true, verifiedAt: true } },
      wallets: { where: { isActive: true } },
      workerProfile: true,
      posterProfile: true,
      _count: { select: { tasksCreated: true, taskSubmissions: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');

  // Remove sensitive fields
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

// ── Update profile ─────────────────────────────

const updateProfile = async (userId, updates) => {
  const allowed = ['firstName', 'lastName', 'phone', 'avatarUrl', 'coverUrl', 'username', 'twitter', 'telegram', 'discord', 'website', 'preferences', 'isPublic'];
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

const getPublicProfile = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      kyc: { select: { status: true, verifiedAt: true } },
      wallets: { where: { isActive: true } },
      workerProfile: true,
      posterProfile: true,
      _count: { select: { tasksCreated: true, taskSubmissions: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  const { passwordHash, ...safeUser } = user;
  return safeUser;
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
  getProfile,
  updateProfile,
  uploadAvatar,
  uploadCover,
  getPublicProfile,
  getTransactionHistory,
  getReferralStats,
  getEarnings,
};
