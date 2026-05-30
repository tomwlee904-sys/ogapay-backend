'use strict';

const axios = require('axios');
const { prisma } = require('../config/database');
const { supabaseAdmin } = require('../config/supabase');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const DOJAH_BASE = process.env.DOJAH_BASE_URL || 'https://api.dojah.io';
const KYC_BUCKET = process.env.SUPABASE_KYC_BUCKET || 'Kyc-Documents';

// ── Submit KYC ─────────────────────────────────

const submitKyc = async (userId, { idType, idNumber, dateOfBirth, address, city, state }) => {
  const existing = await prisma.kycVerification.findUnique({ where: { userId } });
  if (existing?.status === 'APPROVED') throw ApiError.badRequest('KYC already approved');
  if (existing?.status === 'SUBMITTED') throw ApiError.badRequest('KYC already submitted and under review');

  // Update KYC record
  await prisma.kycVerification.upsert({
    where: { userId },
    create: { userId, idType, idNumber, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, address, city, state, status: 'SUBMITTED', submittedAt: new Date() },
    update: { idType, idNumber, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, address, city, state, status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null },
  });

  logger.info(`KYC submitted for user ${userId} — ${idType}`);
  return { message: 'KYC submitted successfully. Verification takes 1-24 hours.' };
};

// ── Verify NIN via Dojah ───────────────────────

const verifyNinWithDojah = async (nin, dateOfBirth) => {
  try {
    const { data } = await axios.get(`${DOJAH_BASE}/api/v1/kyc/nin`, {
      params: { nin },
      headers: {
        AppId: process.env.DOJAH_APP_ID,
        Authorization: process.env.DOJAH_SECRET_KEY,
        Accept: 'application/json',
      },
    });

    if (data.entity) {
      return { verified: true, data: data.entity };
    }
    return { verified: false, reason: 'NIN not found' };
  } catch (err) {
    logger.error('Dojah NIN verification error:', err.response?.data || err.message);
    return { verified: false, reason: 'Verification service unavailable' };
  }
};

// ── Verify BVN via Dojah ───────────────────────

const verifyBvnWithDojah = async (bvn) => {
  try {
    const { data } = await axios.get(`${DOJAH_BASE}/api/v1/kyc/bvn`, {
      params: { bvn },
      headers: {
        AppId: process.env.DOJAH_APP_ID,
        Authorization: process.env.DOJAH_SECRET_KEY,
        Accept: 'application/json',
      },
    });

    if (data.entity) {
      return { verified: true, data: data.entity };
    }
    return { verified: false, reason: 'BVN not found' };
  } catch (err) {
    logger.error('Dojah BVN verification error:', err.response?.data || err.message);
    return { verified: false, reason: 'Verification service unavailable' };
  }
};

// ── Upload KYC documents to Supabase Storage ───

const uploadKycDocument = async (userId, file, documentType) => {
  // documentType: 'id_front' | 'id_back' | 'selfie'
  const fileName = `kyc/${userId}/${documentType}_${Date.now()}.${file.mimetype.split('/')[1]}`;

  const { data, error } = await supabaseAdmin.storage
    .from(KYC_BUCKET)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw ApiError.internal('Failed to upload document');

  const { data: urlData } = supabaseAdmin.storage.from(KYC_BUCKET).getPublicUrl(fileName);

  // Save URL to KYC record
  const fieldMap = {
    id_front: 'idFrontUrl',
    id_back: 'idBackUrl',
    selfie: 'selfieUrl',
  };

  await prisma.kycVerification.update({
    where: { userId },
    data: { [fieldMap[documentType]]: urlData.publicUrl },
  });

  return urlData.publicUrl;
};

// ── Get KYC status ─────────────────────────────

const getKycStatus = async (userId) => {
  const kyc = await prisma.kycVerification.findUnique({
    where: { userId },
    select: {
      status: true,
      idType: true,
      submittedAt: true,
      verifiedAt: true,
      rejectionReason: true,
      idFrontUrl: true,
      idBackUrl: true,
      selfieUrl: true,
    },
  });

  if (!kyc) throw ApiError.notFound('KYC record not found');
  return kyc;
};

// ── Admin: Approve / Reject KYC ───────────────

const adminReviewKyc = async (adminId, userId, { action, rejectionReason }) => {
  const kyc = await prisma.kycVerification.findUnique({ where: { userId } });
  if (!kyc) throw ApiError.notFound('KYC not found');
  if (kyc.status !== 'SUBMITTED') throw ApiError.badRequest('KYC is not pending review');

  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

  await prisma.kycVerification.update({
    where: { userId },
    data: {
      status: newStatus,
      rejectionReason: action === 'reject' ? rejectionReason : null,
      verifiedAt: action === 'approve' ? new Date() : null,
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: newStatus === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
      title: newStatus === 'APPROVED' ? '✅ KYC Approved!' : '❌ KYC Rejected',
      body: newStatus === 'APPROVED'
        ? 'Your identity has been verified. You can now access all features.'
        : `Your KYC was rejected: ${rejectionReason || 'Please resubmit with clear documents.'}`,
    },
  });

  logger.info(`KYC ${newStatus} for user ${userId} by admin ${adminId}`);
  return { status: newStatus };
};

// ── Admin: List pending KYC submissions ────────

const listPendingKyc = async ({ page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    prisma.kycVerification.findMany({
      where: { status: 'SUBMITTED' },
      skip,
      take: parseInt(limit),
      orderBy: { submittedAt: 'asc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.kycVerification.count({ where: { status: 'SUBMITTED' } }),
  ]);
  return { records, total };
};

module.exports = {
  submitKyc,
  verifyNinWithDojah,
  verifyBvnWithDojah,
  uploadKycDocument,
  getKycStatus,
  adminReviewKyc,
  listPendingKyc,
};
