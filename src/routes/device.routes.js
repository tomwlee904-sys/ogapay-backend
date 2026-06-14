'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');
const crypto = require('crypto');
const router = express.Router();

// GET /devices/count/:username — public device count for a user (used in public profile)
router.get('/count/:username', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true, isPublic: true },
  });
  if (!user || !user.isPublic) {
    return successResponse(res, { count: 0 });
  }
  const count = await prisma.device.count({
    where: { userId: user.id },
  });
  successResponse(res, { count });
});

const parseUserAgent = (ua) => {
  if (!ua) return { name: 'Unknown device', browser: null, os: null };
  let browser = null, os = null;
  if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Edge/')) browser = 'Edge';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  const name = [browser, os].filter(Boolean).join(' on ') || 'Unknown device';
  return { name, browser, os };
};

// GET /devices — list paired devices for current user
router.get('/', authenticate, async (req, res) => {
  const devices = await prisma.device.findMany({
    where: { userId: req.user.id },
    orderBy: { lastActiveAt: 'desc' },
  });
  successResponse(res, devices);
});

// POST /devices/pair/generate — generate a 6-digit pairing code
router.post('/pair/generate', authenticate, async (req, res) => {
  // Invalidate any existing unused codes for this user
  await prisma.pairingCode.updateMany({
    where: { userId: req.user.id, used: false, expiresAt: { gt: new Date() } },
    data: { used: true },
  });

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await prisma.pairingCode.create({
    data: { userId: req.user.id, code, expiresAt },
  });

  successResponse(res, { code, expiresAt }, 'Pairing code generated');
});

// POST /devices/pair/verify — verify a pairing code and link this device
router.post('/pair/verify', authenticate, async (req, res) => {
  const { code, deviceName } = req.body;
  if (!code) throw ApiError.badRequest('Pairing code is required');

  const pairingCode = await prisma.pairingCode.findFirst({
    where: { code, used: false, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!pairingCode) throw ApiError.badRequest('Invalid or expired pairing code');

  // Mark code as used
  await prisma.pairingCode.update({
    where: { id: pairingCode.id },
    data: { used: true },
  });

  const ua = req.headers['user-agent'];
  const parsed = parseUserAgent(ua);

  // Check if this device already exists for this user
  const existing = await prisma.device.findFirst({
    where: { userId: pairingCode.userId, name: deviceName || parsed.name },
  });

  if (existing) {
    await prisma.device.update({
      where: { id: existing.id },
      data: { lastActiveAt: new Date(), lastIp: req.ip },
    });
    return successResponse(res, { device: existing, message: 'Device already paired' }, 'Device linked successfully');
  }

  const device = await prisma.device.create({
    data: {
      userId: pairingCode.userId,
      name: deviceName || parsed.name,
      deviceType: req.headers['sec-ch-ua-platform'] || null,
      os: parsed.os,
      browser: parsed.browser,
      lastIp: req.ip,
      lastActiveAt: new Date(),
    },
  });

  successResponse(res, { device }, 'Device linked successfully');
});

// DELETE /devices/:id — remove a paired device
router.delete('/:id', authenticate, async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!device) throw ApiError.notFound('Device not found');

  await prisma.device.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Device removed');
});

module.exports = router;
