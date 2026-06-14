'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');
const router = express.Router();

// GET /links/wallets — list connected crypto wallets
router.get('/wallets', authenticate, async (req, res) => {
  const wallets = await prisma.connectedWallet.findMany({
    where: { userId: req.user.id },
    orderBy: { verifiedAt: 'desc' },
  });
  successResponse(res, wallets);
});

// POST /links/wallet/add — add a connected crypto wallet
router.post('/wallet/add', authenticate, async (req, res) => {
  const { type, address, label } = req.body;
  if (!type || !address) throw ApiError.badRequest('Wallet type and address required');

  const existing = await prisma.connectedWallet.findFirst({
    where: { userId: req.user.id, address },
  });
  if (existing) throw ApiError.conflict('Wallet already connected');

  const wallet = await prisma.connectedWallet.create({
    data: { userId: req.user.id, type, address, label },
  });
  successResponse(res, wallet, 'Wallet connected');
});

// DELETE /links/wallet/:id — disconnect a wallet
router.delete('/wallet/:id', authenticate, async (req, res) => {
  const wallet = await prisma.connectedWallet.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!wallet) throw ApiError.notFound('Wallet not found');
  await prisma.connectedWallet.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Wallet disconnected');
});

// GET /links/banks — list bank accounts
router.get('/banks', authenticate, async (req, res) => {
  const banks = await prisma.bankAccount.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  successResponse(res, banks);
});

// POST /links/bank/add — add a bank account
router.post('/bank/add', authenticate, async (req, res) => {
  const { bankName, bankCode, accountNumber, accountName } = req.body;
  if (!bankName || !bankCode || !accountNumber) throw ApiError.badRequest('Bank name, code, and account number required');

  const existing = await prisma.bankAccount.findFirst({
    where: { userId: req.user.id, accountNumber },
  });
  if (existing) throw ApiError.conflict('Bank account already added');

  const bank = await prisma.bankAccount.create({
    data: { userId: req.user.id, bankName, bankCode, accountNumber, accountName },
  });
  successResponse(res, bank, 'Bank account added');
});

// DELETE /links/bank/:id — remove a bank account
router.delete('/bank/:id', authenticate, async (req, res) => {
  const bank = await prisma.bankAccount.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!bank) throw ApiError.notFound('Bank account not found');
  await prisma.bankAccount.delete({ where: { id: req.params.id } });
  successResponse(res, null, 'Bank account removed');
});

module.exports = router;
