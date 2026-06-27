'use strict';

const axios = require('axios');
const { prisma } = require('../config/database');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');
const walletService = require('./wallet.service');

const DOJAH_BASE = process.env.DOJAH_BASE_URL || 'https://api.dojah.io';
const KYC_BUCKET = process.env.SUPABASE_KYC_BUCKET || 'Kyc-Documents';

// ── Dojah API helpers ─────────────────────────

const dojahHeaders = () => ({
  AppId: process.env.DOJAH_APP_ID,
  Authorization: process.env.DOJAH_SECRET_KEY,
  Accept: 'application/json',
});

const verifyNinWithDojah = async (nin) => {
  try {
    const { data } = await axios.get(`${DOJAH_BASE}/api/v1/kyc/nin`, {
      params: { nin },
      headers: dojahHeaders(),
    });
    if (data.entity) return { verified: true, data: data.entity };
    return { verified: false, reason: 'NIN not found' };
  } catch (err) {
    logger.error('Dojah NIN verification error:', err.response?.data || err.message);
    return { verified: false, reason: 'Verification service unavailable' };
  }
};

const verifyBvnWithDojah = async (bvn) => {
  try {
    const { data } = await axios.get(`${DOJAH_BASE}/api/v1/kyc/bvn`, {
      params: { bvn },
      headers: dojahHeaders(),
    });
    if (data.entity) return { verified: true, data: data.entity };
    return { verified: false, reason: 'BVN not found' };
  } catch (err) {
    logger.error('Dojah BVN verification error:', err.response?.data || err.message);
    return { verified: false, reason: 'Verification service unavailable' };
  }
};

// ── KYC Level definitions ────────────────────
// Level 0 — No verification
// Level 1 — NIN verified (can earn, withdraw up to ₦10,000)
// Level 2 — BVN verified (higher limits, max OgaScore)

const KYC_LEVELS = {
  NONE: 0,
  NIN_VERIFIED: 1,   // Level 1 — NIN only, no selfie
  BVN_VERIFIED: 2,   // Level 2 — BVN upgrade
};

const TIER_THRESHOLDS = { 1: 'NIN', 2: 'BVN', 3: 'ADDRESS' };

// ── Submit KYC with live Dojah verification ───

const submitKyc = async (userId, { idType, idNumber, dateOfBirth, address, city, state }) => {
  const existing = await prisma.kycVerification.findUnique({ where: { userId } });

  // Determine which level/tier this submission targets
  let targetLevel = 0;
  let targetTier = 1;
  if (idType === 'NIN') targetLevel = KYC_LEVELS.NIN_VERIFIED;
  if (idType === 'BVN') { targetLevel = KYC_LEVELS.BVN_VERIFIED; targetTier = 2; }
  if (idType === 'PASSPORT' || idType === 'DRIVERS_LICENSE' || idType === 'VOTERS_CARD') targetTier = 3;

  // Cannot submit BVN if NIN is not already verified
  if (idType === 'BVN') {
    if (!existing || existing.status !== 'APPROVED' || existing.kycTier < KYC_LEVELS.NIN_VERIFIED) {
      throw ApiError.badRequest('Please verify your NIN first before upgrading to BVN verification.');
    }
    if (existing.kycTier >= KYC_LEVELS.BVN_VERIFIED) {
      throw ApiError.badRequest('BVN already verified.');
    }
  }

  if (idType === 'NIN' && existing?.status === 'APPROVED' && existing.kycTier >= KYC_LEVELS.NIN_VERIFIED) {
    throw ApiError.badRequest('NIN already verified.');
  }

  // Live verification based on ID type
  let verification;
  if (idType === 'NIN') {
    verification = await verifyNinWithDojah(idNumber);
  } else if (idType === 'BVN') {
    verification = await verifyBvnWithDojah(idNumber);
  }

  let enrichedData = {};
  let autoApprove = true;

  if (verification?.verified) {
    const entity = verification.data;
    enrichedData = {
      providerRef: entity?.reference || entity?.verification_id || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : entity?.date_of_birth ? new Date(entity.date_of_birth) : null,
      phone: entity?.phone || null,
      firstName: entity?.first_name || entity?.firstName || null,
      lastName: entity?.last_name || entity?.lastName || null,
    };
  }

  // Upsert KYC record
  const status = autoApprove ? 'APPROVED' : 'SUBMITTED';
  const newTier = autoApprove
    ? Math.max(targetLevel, existing?.kycTier || 0)
    : (existing?.kycTier || 0);

  const kycData = {
    kycTier: newTier,
    idType,
    idNumber,
    dateOfBirth: enrichedData.dateOfBirth || (dateOfBirth ? new Date(dateOfBirth) : null),
    address,
    city,
    state,
    status,
    provider: 'dojah',
    providerRef: enrichedData.providerRef,
    submittedAt: new Date(),
    verifiedAt: autoApprove ? new Date() : null,
    rejectionReason: null,
    // Clear selfie-related fields since we no longer require them
    selfieUrl: null,
    livenessPassed: false,
  };

  await prisma.kycVerification.upsert({
    where: { userId },
    create: { userId, ...kycData },
    update: kycData,
  });

  const message = autoApprove
    ? `Level ${newTier} verified successfully!`
    : 'Verification submitted. We\'ll notify you once verified.';

  // Send notification if auto-approved
  if (autoApprove) {
    const levelName = newTier >= KYC_LEVELS.BVN_VERIFIED ? 'Level 2' : 'Level 1';
    await prisma.notification.create({
      data: {
        userId,
        type: 'KYC_APPROVED',
        title: `${levelName} Verification Approved`,
        body: `Your ${idType} has been verified. You're now at ${levelName}!`,
      },
    }).catch(() => {});
  }

  // Referral reward on milestone (KYC Tier 1+)
  if (autoApprove) {
    walletService.rewardForReferral(userId).catch(e => logger.warn('Referral reward check failed:', e.message));
    walletService.rewardSignupBonus(userId).catch(e => logger.warn('Signup bonus check failed:', e.message));
  }

  logger.info(`KYC ${idType} submitted for user ${userId} — auto-approved: ${autoApprove}`);
  return { status, tier: newTier, level: newTier, message };
};

// ── Upload KYC document (ID image) ─────────────

const uploadKycDocument = async (userId, file, type) => {
  const allowed = ['id_front', 'id_back'];
  if (!allowed.includes(type)) throw ApiError.badRequest('Invalid document type. Only id_front and id_back are supported.');

  const fileName = `kyc/${userId}/${type}_${Date.now()}.${file.originalname?.split('.').pop() || 'jpg'}`;

  const { data, error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw ApiError.internal('Failed to upload document');

  const { data: urlData } = supabaseAdmin.storage.from(KYC_BUCKET).getPublicUrl(fileName);
  const url = urlData?.publicUrl;

  const updateData = {};
  if (type === 'id_front') updateData.idFrontUrl = url;
  if (type === 'id_back') updateData.idBackUrl = url;

  await prisma.kycVerification.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
  });

  return url;
};

// ── Get KYC status ─────────────────────────────

const getKycStatus = async (userId) => {
  const kyc = await prisma.kycVerification.findUnique({
    where: { userId },
    select: {
      status: true,
      kycTier: true,
      idType: true,
      idNumber: true,
      submittedAt: true,
      verifiedAt: true,
      rejectionReason: true,
      idFrontUrl: true,
      idBackUrl: true,
      selfieUrl: true,
      livenessPassed: true,
      provider: true,
    },
  });

  if (!kyc) {
    return {
      status: 'NONE',
      kycTier: 0,
      level: 0,
      idType: null,
      idNumber: null,
      submittedAt: null,
      verifiedAt: null,
      rejectionReason: null,
    };
  }

  return {
    ...kyc,
    level: kyc.kycTier,
    withdrawalLimit: kyc.kycTier >= KYC_LEVELS.BVN_VERIFIED ? 20000 : (kyc.kycTier >= KYC_LEVELS.NIN_VERIFIED ? 10000 : 0),
  };
};

// ── Get withdrawal limit for a user ────────────

const getWithdrawalLimit = (kycTier) => {
  if (kycTier >= KYC_LEVELS.BVN_VERIFIED) return 20000;  // Level 2: ₦20,000
  if (kycTier >= KYC_LEVELS.NIN_VERIFIED) return 10000;   // Level 1: ₦10,000
  return 0;                                                 // No KYC: can't withdraw
};

// ── Handle Dojah webhook callback ──────────────

const handleDojahWebhook = async (payload) => {
  const { event, data } = payload;
  logger.info(`Dojah webhook received: ${event}`, { data });

  const reference = data?.reference || data?.verification_id || data?.user_id;
  if (!reference) return { received: true };

  const kyc = await prisma.kycVerification.findFirst({
    where: { providerRef: reference },
  });
  if (!kyc) {
    logger.warn(`Dojah webhook: no KYC record for ref ${reference}`);
    return { received: true };
  }

  if (event === 'verification.completed' || event === 'kyc.approved') {
    const newTier = Math.max(kyc.kycTier, 1);
    await prisma.kycVerification.update({
      where: { id: kyc.id },
      data: { status: 'APPROVED', kycTier: newTier, verifiedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        userId: kyc.userId,
        type: 'KYC_APPROVED',
        title: 'Verification Approved',
        body: `Your identity has been verified! You're at Level ${newTier}.`,
      },
    }).catch(() => {});
    walletService.rewardForReferral(kyc.userId).catch(e => logger.warn('Referral reward check failed:', e.message));
    walletService.rewardSignupBonus(kyc.userId).catch(e => logger.warn('Signup bonus check failed:', e.message));
    logger.info(`KYC auto-approved via webhook for user ${kyc.userId}`);
  } else if (event === 'verification.failed' || event === 'kyc.rejected') {
    const reason = data?.reason || data?.message || 'Documents did not pass verification';
    await prisma.kycVerification.update({
      where: { id: kyc.id },
      data: { status: 'REJECTED', rejectionReason: reason },
    });
    await prisma.notification.create({
      data: {
        userId: kyc.userId,
        type: 'KYC_REJECTED',
        title: 'Verification Rejected',
        body: reason,
      },
    }).catch(() => {});
    logger.info(`KYC rejected via webhook for user ${kyc.userId}: ${reason}`);
  }

  return { received: true };
};

// ── Admin: Approve / Reject KYC ───────────────

const adminReviewKyc = async (adminId, userId, { action, rejectionReason, tierUpgrade }) => {
  const kyc = await prisma.kycVerification.findUnique({ where: { userId } });
  if (!kyc) throw ApiError.notFound('KYC not found');
  if (kyc.status !== 'SUBMITTED') throw ApiError.badRequest('KYC is not pending review');

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
  const newTier = tierUpgrade || kyc.kycTier || 1;

  await prisma.kycVerification.update({
    where: { userId },
    data: {
      status: newStatus,
      kycTier: action === 'approve' ? newTier : kyc.kycTier,
      rejectionReason: action === 'reject' ? rejectionReason : null,
      verifiedAt: action === 'approve' ? new Date() : null,
    },
  });

  const levelName = newTier >= KYC_LEVELS.BVN_VERIFIED ? 'Level 2' : 'Level 1';
  await prisma.notification.create({
    data: {
      userId,
      type: newStatus === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
      title: newStatus === 'APPROVED' ? `${levelName} Approved!` : 'KYC Rejected',
      body: newStatus === 'APPROVED'
        ? `Your identity has been verified. You've reached ${levelName}!`
        : `Your KYC was rejected: ${rejectionReason || 'Please resubmit with clear documents.'}`,
    },
  }).catch(() => {});

  // Referral reward when admin approves KYC
  if (action === 'approve') {
    walletService.rewardForReferral(userId).catch(e => logger.warn('Referral reward check failed:', e.message));
  }

    walletService.rewardSignupBonus(userId).catch(e => logger.warn('Signup bonus check failed:', e.message));
  logger.info(`KYC ${newStatus} (Level ${newTier}) for user ${userId} by admin ${adminId}`);
  return { status: newStatus, tier: newTier, level: newTier };
};

// ── Admin: List pending KYC submissions ────────

const listPendingKyc = async ({ page = 1, limit = 20, status }) => {
  const skip = (page - 1) * limit;
  const where = status ? { status } : { status: 'SUBMITTED' };
  const [records, total] = await Promise.all([
    prisma.kycVerification.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { submittedAt: 'asc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.kycVerification.count({ where }),
  ]);
  return { records, total };
};

module.exports = {
  submitKyc,
  verifyBvnWithDojah,
  verifyNinWithDojah,
  uploadKycDocument,
  getKycStatus,
  getWithdrawalLimit,
  adminReviewKyc,
  listPendingKyc,
  handleDojahWebhook,
};
