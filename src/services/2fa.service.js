'use strict';

const otplib = require('otplib');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');

const ISSUER = 'OgaPay';

const generateSecret = (email) => {
  const secret = otplib.generateSecret();
  const otpauth = otplib.generateURI({ type: 'totp', accountName: email, issuer: ISSUER, secret });
  return { secret, otpauth };
};

const generateQrDataUri = async (otpauth) => {
  return QRCode.toDataURL(otpauth);
};

const generateBackupCodes = (count = 8) => {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 10)
  );
};

// otplib v13's verify() is async and resolves to { valid }; returning that
// Promise made every code count as correct (a Promise is truthy), so 2FA
// accepted any 6 digits at sign-in and when turning it off. verifySync gives
// the real answer. 30 seconds either side allows for a phone clock that's off.
const verifyToken = (token, secret) => {
  const code = String(token ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code) || !secret) return false;
  try {
    return otplib.verifySync({ token: code, secret, epochTolerance: 30 })?.valid === true;
  } catch {
    return false;
  }
};

const setup = async (userId, email) => {
  const { secret, otpauth } = generateSecret(email);
  const qrCode = await generateQrDataUri(otpauth);
  const backupCodes = generateBackupCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      twoFactorBackupCodes: backupCodes,
    },
  });

  return { secret, qrCode, backupCodes };
};

const verify = async (userId, token) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true },
  });

  if (!user?.twoFactorSecret) {
    throw ApiError.badRequest('2FA not set up');
  }

  const isValid = verifyToken(token, user.twoFactorSecret);
  if (!isValid) {
    throw ApiError.unauthorized('Invalid 2FA code');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isTwoFactorEnabled: true },
  });

  return true;
};

const verifyChallenge = async (userId, token) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorBackupCodes: true },
  });

  if (!user?.twoFactorSecret) {
    return false;
  }

  if (verifyToken(token, user.twoFactorSecret)) {
    return true;
  }

  if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
    const idx = user.twoFactorBackupCodes.indexOf(token);
    if (idx !== -1) {
      const updated = [...user.twoFactorBackupCodes];
      updated.splice(idx, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: updated },
      });
      return true;
    }
  }

  return false;
};

const disable = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });
};

module.exports = { setup, verify, verifyChallenge, disable };
