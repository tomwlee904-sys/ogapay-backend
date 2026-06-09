'use strict';

const express = require('express');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default;
const { authenticate, requireKyc } = require('../middleware/auth.middleware');
const { validate, depositSchema, withdrawSchema } = require('../middleware/validate');
const { prisma } = require('../config/database');
const walletService = require('../services/wallet.service');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');

const router = express.Router();

// ─── Public: request a nonce to sign ──────────────────────────
// Anyone can request a nonce for any wallet address (no auth needed)
router.post('/nonce', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet || typeof wallet !== 'string') throw ApiError.badRequest('Valid wallet address required');

  const w = wallet.trim();
  // Basic Solana address check: base58, 32-44 chars
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) throw ApiError.badRequest('Invalid Solana wallet address');

  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60_000); // 5 min

  await prisma.walletNonce.upsert({
    where: { wallet: w },
    update: { nonce, expiresAt },
    create: { wallet: w, nonce, expiresAt },
  });

  successResponse(res, { nonce, message: `Sign this message to verify your wallet.\n\nNonce: ${nonce}` });
});

// ─── Verify a signed nonce ─────────────────────────────────────
router.post('/verify', authenticate, async (req, res) => {
  const { wallet, signature } = req.body;
  if (!wallet || !signature) throw ApiError.badRequest('wallet and signature required');

  const w = wallet.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) throw ApiError.badRequest('Invalid Solana wallet address');

  const stored = await prisma.walletNonce.findUnique({ where: { wallet: w } });
  if (!stored) throw ApiError.badRequest('No nonce requested for this wallet');
  if (stored.expiresAt < new Date()) throw ApiError.badRequest('Nonce expired. Request a new one.');

  // Reconstruct the message that was signed
  const message = `Sign this message to verify your wallet.\n\nNonce: ${stored.nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = bs58.decode(signature);
  const publicKeyBytes = bs58.decode(w);

  const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  if (!verified) throw ApiError.badRequest('Signature verification failed');

  // Delete the nonce so it can't be reused
  await prisma.walletNonce.delete({ where: { wallet: w } });

  // Save wallet address to user profile
  await prisma.user.update({
    where: { id: req.user.id },
    data: { walletAddress: w },
  });

  // Upsert a Wallet record for the SOL wallet
  await prisma.wallet.upsert({
    where: { userId_currency: { userId: req.user.id, currency: 'SOL' } },
    update: { walletAddress: w, isActive: true },
    create: { userId: req.user.id, currency: 'SOL', walletAddress: w, isActive: true, balance: 0, lockedBalance: 0 },
  });

  successResponse(res, { wallet: w, verified: true });
});

// ─── Check verification status ─────────────────────────────────
router.post('/status', authenticate, async (req, res) => {
  const { wallet } = req.body;
  const w = wallet?.trim();
  if (!w) throw ApiError.badRequest('wallet required');

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { walletAddress: true },
  });

  const verified = user?.walletAddress === w;

  successResponse(res, {
    wallet: w,
    verified,
    // Also check if there's a Wallet record (for backwards compatibility)
    walletRecord: verified
      ? await prisma.wallet.findUnique({ where: { userId_currency: { userId: req.user.id, currency: 'SOL' } } })
      : null,
  });
});

// All remaining wallet routes require auth
router.use(authenticate);

// GET /api/v1/wallets
router.get('/', async (req, res) => {
  const wallets = await walletService.getUserWallets(req.user.id);
  successResponse(res, wallets, 'Wallets fetched');
});

// GET /api/v1/wallet/balance - frontend-friendly balance shape
router.get('/balance', async (req, res) => {
  const wallets = await walletService.getUserWallets(req.user.id);
  const balances = wallets.reduce((acc, wallet) => {
    acc[wallet.currency] = {
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
      available: Math.max(0, Number(wallet.balance) - Number(wallet.lockedBalance)),
    };
    return acc;
  }, {});
  successResponse(res, balances, 'Wallet balance fetched');
});

// POST /api/v1/wallets/deposit
router.post('/deposit', validate(depositSchema), async (req, res) => {
  const data = await walletService.initiateDeposit(req.user.id, req.body);
  successResponse(res, data, 'Deposit initiated. Complete payment to fund your wallet.');
});

// POST /api/v1/wallets/withdraw
router.post('/withdraw', requireKyc, validate(withdrawSchema), async (req, res) => {
  const data = await walletService.initiateWithdrawal(req.user.id, req.body);
  successResponse(res, data, 'Withdrawal request submitted. Processing within 24 hours.');
});

module.exports = router;
