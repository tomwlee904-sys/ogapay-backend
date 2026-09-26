'use strict';

// OgaScore is worked out from things we have actually verified: accounts
// connected through OAuth, KYC level and human verification. It used to be
// raised by POST /auth/connect/:platform, which marked an account "connected"
// without any OAuth, so anyone could inflate it (and jobs can require a score).
const { prisma } = require('../config/database');

const POINTS = {
  linkedin: 10,
  twitter: 8,
  github: 8,
  google: 5,
  telegram: 5,
  kycLevel1: 10, // NIN
  kycLevel2: 10, // BVN, on top of level 1
  human: 10,     // VeryAI
};
const MAX_SCORE = Object.values(POINTS).reduce((a, b) => a + b, 0);

const SCORE_FIELDS = {
  linkedinOAuthConnected: true, twitterOAuthConnected: true, githubOAuthConnected: true,
  googleOAuthConnected: true, telegramOAuthConnected: true, humanVerifiedAt: true,
  ogaScore: true, kyc: { select: { status: true, kycTier: true } },
};

function computeOgaScore(u) {
  if (!u) return 0;
  const tier = u.kyc?.status === 'APPROVED' ? (u.kyc.kycTier || 0) : 0;
  return (u.linkedinOAuthConnected ? POINTS.linkedin : 0)
    + (u.twitterOAuthConnected ? POINTS.twitter : 0)
    + (u.githubOAuthConnected ? POINTS.github : 0)
    + (u.googleOAuthConnected ? POINTS.google : 0)
    + (u.telegramOAuthConnected ? POINTS.telegram : 0)
    + (tier >= 1 ? POINTS.kycLevel1 : 0)
    + (tier >= 2 ? POINTS.kycLevel2 : 0)
    + (u.humanVerifiedAt ? POINTS.human : 0);
}

// Recompute and store; returns the score. Never throws (callers are side paths).
async function syncOgaScore(userId, db = prisma) {
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: SCORE_FIELDS });
    if (!u) return 0;
    const score = computeOgaScore(u);
    if (score !== u.ogaScore) await db.user.update({ where: { id: userId }, data: { ogaScore: score } });
    return score;
  } catch {
    return 0;
  }
}

module.exports = { POINTS, MAX_SCORE, SCORE_FIELDS, computeOgaScore, syncOgaScore };
