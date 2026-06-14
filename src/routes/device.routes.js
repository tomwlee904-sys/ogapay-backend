'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { successResponse } = require('../utils/apiResponse');
const crypto = require('crypto');

const router = express.Router();

// List all paired devices for the current user
router.get('/', authenticate, async (req, res) => {
  const devices = await prisma.device.findMany({
    where: { userId: req.user.id },
    orderBy: { lastActiveAt: 'desc' },
  });
  res.json({ success: true, data: devices });
});

// Generate a pairing code
router.post('/pair/generate', authenticate, async (req, res) => {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
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

  await prisma.device.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Device removed');
});

module.exports = router;
