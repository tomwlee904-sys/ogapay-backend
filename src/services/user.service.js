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
  const allowed = ['firstName', 'lastName', 'phone', 'avatarUrl'];
  const data = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  );

  // Worker-specific updates
  if (updates.bio !== undefined || updates.skills !== undefined || updates.isAvailable !== undefined) {
    await prisma.workerProfile.updateMany({
      where: { userId },
      data: {
        ...(updates.bio !== undefined && { bio: updates.bio }),
        ...(updates.skills !== undefined && { skills: updates.skills }),
        ...(updates.isAvailable !== undefined && { isAvailable: updates.isAvailable }),
      },
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

  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true, username: true, role: true },
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

// ── Get public worker profile ──────────────────

const getWorkerPublicProfile = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      firstName: true,
      avatarUrl: true,
      createdAt: true,
      workerProfile: {
        select: {
          level: true,
          reputationScore: true,
          tasksCompleted: true,
          successRate: true,
          avgRating: true,
          totalRatings: true,
          skills: true,
          bio: true,
          isAvailable: true,
        },
      },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
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
  const [user, referrals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } }),
    prisma.user.count({ where: { referredById: userId } }),
  ]);

  return {
    referralCode: user.referralCode,
    referralLink: `${process.env.FRONTEND_URL}/join?ref=${user.referralCode}`,
    totalReferrals: referrals,
  };
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getWorkerPublicProfile,
  getTransactionHistory,
  getReferralStats,
};
