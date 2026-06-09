'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const docs = await prisma.vaultDocument.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  successResponse(res, docs);
});

router.get('/stats', async (req, res) => {
  const docs = await prisma.vaultDocument.findMany({
    where: { userId: req.user.id },
  });
  const count = docs.length;
  const totalSize = docs.reduce((sum, d) => sum + d.size, 0);
  const verified = docs.filter(d => d.isVerified).length;

  const fmtSize = totalSize < 1024 ? `${totalSize} B`
    : totalSize < 1048576 ? `${(totalSize / 1024).toFixed(1)} KB`
    : `${(totalSize / 1048576).toFixed(1)} MB`;

  successResponse(res, { count: String(count), totalSize: fmtSize, verified: String(verified) });
});

router.post('/upload', async (req, res) => {
  const { name, type, size, url } = req.body;
  const doc = await prisma.vaultDocument.create({
    data: { userId: req.user.id, name, type, size: Number(size), url },
  });
  successResponse(res, doc);
});

module.exports = router;
