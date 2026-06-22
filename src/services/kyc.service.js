'use strict';

const axios = require('axios');
const { prisma } = require('../config/database');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const DOJAH_BASE = process.env.DOJAH_BASE_URL || 'https://api.dojah.io';
const KYC_BUCKET = process.env.SUPABASE_KYC_BUCKET || 'Kyc-Documents';

// ── Dojah API helpers ─────────────────────────

const dojahHeaders = () => ({
  AppId: process.env.DOJAH_APP_ID,
  Authorization: process.env.DOJAH_SECRET_KEY,
  Accept: 'application/json',
});

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

const verifySelfieWithDojah = async (selfieUrl, idFrontUrl) => {
  try {
    const { data } = await axios.post(`${DOJAH_BASE}/api/v1/kyc/selfie/verify`,
      { selfie_image: selfieUrl, front_image: idFrontUrl },
      { headers: dojahHeaders() },
    );
    const match = data?.entity?.match || data?.entity?.confidence;
    return { verified: match > 50, confidence: match || 0 };
  } catch (err) {
    logger.error('Dojah selfie verification error:', err.response?.data || err.message);
    return { verified: false, reason: 'Liveness check unavailable' };
  }
};

// ── Tier definitions ──────────────────────────
// Tier 1 — BVN verification
// Tier 2 — NIN + selfie
// Tier 3 — Address + document uploads

const TIER_THRESHOLDS = { 1: 'BVN', 2: 'NIN', 3: 'ADDRESS' };

// ── Submit KYC with live Dojah verification ───

const submitKyc = async (userId, { idType, idNumber, dateOfBirth, address, city, state }) => {
  const existing = await prisma.kycVerification.findUnique({ where: { userId } });
  if (existing?.status === 'APPROVED') throw ApiError.badRequest('KYC already approved');

  // Determine which tier this submission targets
  let targetTier = 1;
  if (idType === 'NIN') targetTier = 2;
  if (idType === 'PASSPORT' || idType === 'DRIVERS_LICENSE' || idType === 'VOTERS_CARD') targetTier = 3;

  // Live verification based on ID type
  let verification;
  if (idType === 'BVN') {
    verification = await verifyBvnWithDojah(idNumber);
  } else if (idType === 'NIN') {
    verification = await verifyNinWithDojah(idNumber);
  }

  // If we got a match from Dojah, extract enriched data
  let enrichedData = {};
  let autoApprove = false;

  if (verification?.verified) {
    autoApprove = true;
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
  const tier = autoApprove ? targetTier : (existing?.kycTier || 0);

  await prisma.kycVerification.upsert({
    where: { userId },
    create: {
      userId,
      kycTier: tier,
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
    },
    update: {
      kycTier: tier,
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
    },
  });

  // Upgrade tier if auto-approved and user already had a lower tier
  if (autoApprove && existing && targetTier > existing.kycTier) {
    await prisma.kycVerification.update({
      where: { userId },
      data: { kycTier: targetTier, status: 'APPROVED' },
    });
  }

  await prisma.notification.create({
    data: {
      userId,
      type: autoApprove ? 'KYC_APPROVED' : 'KYC_SUBMITTED',
      title: autoApprove ? 'Verification Approved!' : 'Verification Submitted',
      body: autoApprove
        ? `Your ${idType} has been verified automatically. You've reached Tier ${targetTier}!`
        : 'Your documents are under review. You will be notified once verified.',
    },
  });

  logger.info(`KYC ${idType} submitted for user ${userId} — auto-approved: ${autoApprove}`);
  return {
    message: autoApprove
      ? `Verification successful! You've completed Tier ${targetTier}.`
      : 'KYC submitted successfully. Verification takes 1-24 hours.',
    status,
    tier,
  };
};

// ── Upload KYC documents to Supabase Storage ───

const uploadKycDocument = async (userId, file, documentType) => {
  const fileName = `kyc/${userId}/${documentType}_${Date.now()}.${file.mimetype.split('/')[1] || 'jpg'}`;

  const { error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw ApiError.internal('Failed to upload document');

  const { data: urlData } = supabaseAdmin.storage.from(KYC_BUCKET).getPublicUrl(fileName);
  const url = urlData.publicUrl;

  const fieldMap = {
    id_front: 'idFrontUrl',
    id_back: 'idBackUrl',
    selfie: 'selfieUrl',
  };

  const updateData = { [fieldMap[documentType]]: url };

  // If uploading selfie, verify liveness against existing ID front
  if (documentType === 'selfie') {
    const kyc = await prisma.kycVerification.findUnique({ where: { userId } });
    if (kyc?.idFrontUrl) {
      const liveness = await verifySelfieWithDojah(url, kyc.idFrontUrl);
      if (liveness.verified) {
        updateData.livenessPassed = true;
      }
    }
  }

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

  if (!kyc) throw ApiError.notFound('KYC record not found');
  return kyc;
};

// ── Handle Dojah webhook callback ──────────────

const handleDojahWebhook = async (payload) => {
  const { event, data } = payload;
  logger.info(`Dojah webhook received: ${event}`, { data });

  const reference = data?.reference || data?.verification_id || data?.user_id;
  if (!reference) return { received: true };

  // Find KYC record by providerRef
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
        body: 'Your identity has been verified successfully!',
      },
    });
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
    });
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

  await prisma.notification.create({
    data: {
      userId,
      type: newStatus === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
      title: newStatus === 'APPROVED' ? 'KYC Approved!' : 'KYC Rejected',
      body: newStatus === 'APPROVED'
        ? `Your identity has been verified. You've reached Tier ${newTier}!`
        : `Your KYC was rejected: ${rejectionReason || 'Please resubmit with clear documents.'}`,
    },
  });

  logger.info(`KYC ${newStatus} (Tier ${newTier}) for user ${userId} by admin ${adminId}`);
  return { status: newStatus, tier: newTier };
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
  adminReviewKyc,
  listPendingKyc,
  handleDojahWebhook,
};
