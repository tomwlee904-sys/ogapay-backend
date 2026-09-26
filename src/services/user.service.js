'use strict';

const bcrypt = require('bcryptjs');
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

// ── Delete account ────────────────────────────
// A deleted account can't sign in again, so anything it still holds would be
// lost. Deletion is refused until nothing is left on the platform.

const OPEN_JOB_STATUSES = ['OPEN', 'IN_PROGRESS', 'COOLING_DOWN', 'DISPUTED'];
const OPEN_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS'];
const MIN_SEND_NGN = 100; // sendSchema's minimum

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const walletName = (currency) => (currency === 'NGN' ? 'naira' : currency === 'PAY' ? '$PAY' : currency);
const money = (amount, currency) => {
  const n = Number(amount);
  if (currency !== 'NGN') return `${n.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${walletName(currency)}`;
  const kobo = Number.isInteger(n) ? 0 : 2; // ₦6,000 but ₦2,750.50
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: kobo, maximumFractionDigits: kobo })}`;
};

// Everything that stops the account being deleted, each with what to do first.
// `db` is prisma or a transaction client.
const getDeletionBlockers = async (db, userId) => {
  const blockers = [];

  const wallets = await db.wallet.findMany({
    where: { userId, OR: [{ balance: { gt: 0 } }, { lockedBalance: { gt: 0 } }] },
    select: { currency: true, balance: true, lockedBalance: true },
    orderBy: { currency: 'asc' },
  });
  for (const w of wallets) {
    const held = Number(w.lockedBalance);
    const available = Math.max(0, Math.round((Number(w.balance) - held) * 1e8) / 1e8);
    if (available > 0) {
      let next = 'Withdraw it first.';
      if (w.currency === 'NGN') {
        next = available < MIN_SEND_NGN
          ? `That's under the ₦${MIN_SEND_NGN} minimum for sending, so contact support to close your account.`
          : 'Withdraw it to your bank or send it to another OgaPay user first.';
      } else if (w.currency === 'PAY') {
        next = 'Contact support to close an account that holds $PAY.';
      }
      blockers.push({
        code: 'WALLET_BALANCE', currency: w.currency, amount: available,
        message: `Your ${walletName(w.currency)} wallet has ${money(available, w.currency)} available. ${next}`,
      });
    }
    if (held > 0) {
      blockers.push({
        code: 'FUNDS_ON_HOLD', currency: w.currency, amount: held,
        message: `${money(held, w.currency)} in your ${walletName(w.currency)} wallet is on hold for jobs or withdrawals. It's released or paid out when they finish.`,
      });
    }
  }

  // A paused job (DRAFT) that was funded still holds its escrow
  const jobs = await db.task.findMany({
    where: { posterId: userId, OR: [{ status: { in: OPEN_JOB_STATUSES } }, { status: 'DRAFT', escrowed: true }] },
    select: { title: true },
    orderBy: { createdAt: 'desc' },
  });
  if (jobs.length) {
    const names = jobs.slice(0, 3).map((j) => `"${j.title}"`).join(', ') + (jobs.length > 3 ? ', …' : '');
    blockers.push({
      code: 'OPEN_JOBS', count: jobs.length,
      message: `You have ${plural(jobs.length, 'open job')} you posted (${names}). Cancel ${jobs.length === 1 ? 'it' : 'them'} to get the unused escrow back, or review the work so ${jobs.length === 1 ? 'it can finish' : 'they can finish'}.`,
    });
  }

  const withdrawals = await db.transaction.count({
    where: { userId, type: 'WITHDRAWAL', status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (withdrawals) {
    blockers.push({
      code: 'PENDING_WITHDRAWALS', count: withdrawals,
      message: `You have ${plural(withdrawals, 'withdrawal')} still being processed. Wait until ${withdrawals === 1 ? 'it completes' : 'they complete'}.`,
    });
  }

  const payouts = await db.vaultPayout.aggregate({
    where: { userId, status: 'pending' },
    _count: { _all: true },
    _sum: { shareNgp: true },
  });
  if (payouts._count._all) {
    blockers.push({
      code: 'VAULT_PAYOUTS', count: payouts._count._all, amount: Number(payouts._sum.shareNgp || 0),
      message: `You have unclaimed vault payouts worth ${money(payouts._sum.shareNgp || 0, 'NGN')}. Claim them on the Vault page, then withdraw.`,
    });
  }

  const bought = await db.storePurchase.count({ where: { userId, status: { in: OPEN_ORDER_STATUSES } } });
  if (bought) {
    blockers.push({
      code: 'STORE_ORDERS_BOUGHT', count: bought,
      message: `${plural(bought, 'store order')} you paid for ${bought === 1 ? "hasn't" : "haven't"} been delivered yet. Wait for the seller to deliver, or contact support.`,
    });
  }
  const sold = await db.storePurchase.count({ where: { item: { sellerId: userId }, status: { in: OPEN_ORDER_STATUSES } } });
  if (sold) {
    blockers.push({
      code: 'STORE_ORDERS_SOLD', count: sold,
      message: `${plural(sold, 'order')} from your store still ${sold === 1 ? 'needs' : 'need'} delivering. Deliver and mark ${sold === 1 ? 'it' : 'them'} delivered in My Store.`,
    });
  }

  const disputes = await db.dispute.count({
    where: { resolvedAt: null, OR: [{ workerId: userId }, { posterId: userId }] },
  });
  if (disputes) {
    blockers.push({
      code: 'OPEN_DISPUTES', count: disputes,
      message: `You're part of ${plural(disputes, 'open dispute')}. Wait until ${disputes === 1 ? "it's" : "they're"} resolved.`,
    });
  }

  // Approved work is paid into the wallet, which a deleted account can't reach
  const submitted = await db.taskSubmission.count({ where: { workerId: userId, status: 'SUBMITTED' } });
  if (submitted) {
    blockers.push({
      code: 'WORK_AWAITING_REVIEW', count: submitted,
      message: `${plural(submitted, 'piece of work', 'pieces of work')} you submitted ${submitted === 1 ? 'is' : 'are'} still waiting for review, and approved work is paid to your wallet. Wait until ${submitted === 1 ? "it's" : "they're"} reviewed.`,
    });
  }

  return blockers;
};

// GET /users/me/delete-check: what the Settings dialog shows before asking to confirm
const getDeletionCheck = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw ApiError.notFound('User not found');
  const blockers = await getDeletionBlockers(prisma, userId);
  return { canDelete: blockers.length === 0, blockers, confirmWith: user.passwordHash ? 'password' : 'text' };
};

const deleteAccount = async (userId, { password, confirm } = {}) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw ApiError.notFound('User not found');

  // No one-click deletion: the password, or typing DELETE on accounts without one.
  // (400, not 401: a 401 makes the app try to refresh the session.)
  if (user.passwordHash) {
    if (!password) throw ApiError.badRequest('Enter your password to delete your account');
    if (!(await bcrypt.compare(String(password), user.passwordHash))) throw ApiError.badRequest('Incorrect password');
  } else if (String(confirm ?? '').trim() !== 'DELETE') {
    throw ApiError.badRequest('Type DELETE to confirm');
  }

  await prisma.$transaction(async (db) => {
    // Lock the wallets first: a payment already in flight then lands before the
    // check below and blocks the delete, instead of landing on a closed account.
    await db.$queryRaw`SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE`;
    const blockers = await getDeletionBlockers(db, userId);
    if (blockers.length) {
      throw new ApiError(409, `You can't delete your account yet. ${blockers.map((b) => b.message).join(' ')}`, blockers);
    }
    await db.user.update({
      where: { id: userId },
      data: { isBanned: true, email: `deleted_${userId}@ogapay.com` },
    });
  });
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
  getDeletionCheck,
  deleteAccount,
};
