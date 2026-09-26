'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { successResponse } = require('../utils/apiResponse');
const crypto = require('crypto');

const router = express.Router();

// List all paired devices for the current user
router.get('/', authenticate, async (req, res) => {
  // Only devices that finished pairing (rows with a code are unused codes)
  const devices = await prisma.device.findMany({
    where: { userId: req.user.id, code: null },
    orderBy: { lastActiveAt: 'desc' },
    select: { id: true, name: true, browser: true, os: true, lastActiveAt: true, createdAt: true },
  });
  res.json({ success: true, data: devices });
});

// 25 characters from a 32-letter alphabet without look-alikes (0/O, 1/I): 125 bits.
// The code signs a new device in (POST /auth/pair), so it must not be guessable.
const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPairingCode = () => Array.from(crypto.randomBytes(25), (b) => PAIR_ALPHABET[b % 32]).join('');

// Generate a pairing code (any earlier unused code of this user stops working)
router.post('/pair/generate', authenticate, async (req, res) => {
  // Rows that still hold a code were never paired, so they can go
  await prisma.device.deleteMany({ where: { userId: req.user.id, code: { not: null } } });
  const code = newPairingCode();
  const codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const device = await prisma.device.create({
    data: {
      userId: req.user.id,
      name: req.headers['user-agent'] || 'Unknown',
      code,
      codeExpiresAt,
    },
  });

  res.json({ success: true, data: { code: device.code } });
});

// Cancel this user's active pairing code
router.post('/pair/delete', authenticate, async (req, res) => {
  const { count } = await prisma.device.deleteMany({ where: { userId: req.user.id, code: { not: null } } });
  successResponse(res, { cancelled: count }, 'Pairing code deleted');
});

// Verify and link a device using a pairing code
router.post('/pair/verify', authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Pairing code required' });
  }

  const device = await prisma.device.findFirst({
    where: { code, codeExpiresAt: { gte: new Date() } },
  });

  if (!device) {
    return res.status(400).json({ success: false, message: 'Invalid or expired pairing code' });
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      code: null,
      codeExpiresAt: null,
      lastActiveAt: new Date(),
    },
  });

  res.json({ success: true, message: 'Device linked successfully' });
});

// Remove a paired device
router.delete('/:id', authenticate, async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!device) {
    return res.status(404).json({ success: false, message: 'Device not found' });
  }

  // Removing a device also signs it out (its sessions stayed valid before)
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: req.user.id, deviceId: device.id } }),
    prisma.device.delete({ where: { id: device.id } }),
  ]);
  successResponse(res, null, 'Device removed and signed out');
});

module.exports = router;
