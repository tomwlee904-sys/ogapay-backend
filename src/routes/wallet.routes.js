'use strict';

const express = require('express');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58').default;
const { authenticate, requireKyc } = require('../middleware/auth.middleware');
const { validate, depositSchema, withdrawSchema } = require('../middleware/validate');
const { prisma } = require('../config/database');
const walletService = require('../services/wallet.service');
const solanaService = require('../services/solana.service');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const { v4: uuidv4 } = require('uuid');

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

// ─── x402: Estimate funding ──────────────────────────────────
router.post('/fund/estimate', authenticate, async (req, res) => {
  const { amount, userWallet } = req.body;
  if (!amount || amount <= 0) throw ApiError.badRequest('Valid amount required');
  if (!userWallet) throw ApiError.badRequest('userWallet required');

  const usdcMint = solanaService.USDC_MINT.toString();
  const usdcBalance = await solanaService.getTokenBalance(userWallet, usdcMint);
  const solBalance = await solanaService.getSolBalance(userWallet);
  const targetAmount = Math.round(amount * 1_000_000);

  let quote = null;
  let needsSwap = usdcBalance < targetAmount;

  if (needsSwap && solBalance > 0.001) {
    const jupQuote = await solanaService.getJupiterQuote(
      solanaService.SOL_MINT.toString(),
      usdcMint,
      Math.round(targetAmount - usdcBalance)
    );
    quote = jupQuote;
  }

  successResponse(res, {
    usdcBalance,
    solBalance,
    targetAmount,
    needsSwap,
    quote,
    platformAta: (await solanaService.getPlatformUsdcATA()).toString(),
    usdcMint,
  });
});

// ─── x402: Submit funded transaction ─────────────────────────
router.post('/fund/submit', authenticate, async (req, res) => {
  const { signedTx, expectedAmount } = req.body;
  if (!signedTx || !expectedAmount) throw ApiError.badRequest('signedTx and expectedAmount required');

  const result = await solanaService.verifyAndCreditDeposit(req.user.id, signedTx, expectedAmount);

  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId: req.user.id, currency: 'USDC' } },
    update: { balance: { increment: result.amount } },
    create: { userId: req.user.id, currency: 'USDC', balance: result.amount, isActive: true },
  });

  await prisma.transaction.create({
    data: {
      userId: req.user.id,
      walletId: wallet.id,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: result.amount,
      currency: 'USDC',
      reference: `OGA-X402-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
      externalRef: result.signature,
      balanceBefore: Number(wallet.balance) - result.amount,
      balanceAfter: Number(wallet.balance),
      description: 'USDC deposit via x402',
    },
  });

  successResponse(res, { ...result, newBalance: Number(wallet.balance) });
});

// ─── x402: Swap SOL → USDC (get swap tx to sign) ────────────
router.post('/fund/swap', authenticate, async (req, res) => {
  const { quoteResponse, userWallet } = req.body;
  if (!quoteResponse || !userWallet) throw ApiError.badRequest('quoteResponse and userWallet required');

  const swapData = await solanaService.getJupiterSwapTx(quoteResponse, userWallet);
  successResponse(res, { swapTransaction: swapData.swapTransaction });
});

// ─── Crypto withdrawal ───────────────────────────────────────
router.post('/withdraw/crypto', authenticate, requireKyc, async (req, res) => {
  const { amount, currency, toAddress } = req.body;
  if (!amount || amount <= 0) throw ApiError.badRequest('Valid amount required');
  if (!toAddress) throw ApiError.badRequest('toAddress required');
  if (!currency || !['USDC', 'SOL'].includes(currency)) throw ApiError.badRequest('Currency must be USDC or SOL');

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: req.user.id, currency } },
  });
  if (!wallet) throw ApiError.notFound('Wallet not found');
  if (Number(wallet.balance) - Number(wallet.lockedBalance) < amount) {
    throw ApiError.badRequest('Insufficient available balance');
  }

  let txSig;
  if (currency === 'USDC') {
    txSig = await solanaService.sendUsdc(toAddress, amount);
  } else {
    txSig = await solanaService.sendSol(toAddress, amount);
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  });

  const ref = `OGA-WIT-CRYPTO-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  await prisma.transaction.create({
    data: {
      userId: req.user.id,
      walletId: wallet.id,
      type: 'WITHDRAWAL',
      status: 'COMPLETED',
      amount,
      currency,
      reference: ref,
      externalRef: txSig,
      balanceBefore: Number(wallet.balance) + amount,
      balanceAfter: Number(wallet.balance),
      description: `${currency} withdrawal to ${toAddress}`,
    },
  });

  successResponse(res, { signature: txSig, reference: ref });
});

// POST /api/v1/wallet/credit — no-auth wallet credit (testing phase)
router.post('/credit', async (req, res) => {
  const { email, amount, currency = 'NGN' } = req.body;
  if (!email || !amount || amount <= 0) throw ApiError.badRequest('email and positive amount required');

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw ApiError.notFound('User not found');

  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId: user.id, currency } },
    update: { balance: { increment: parseFloat(amount) } },
    create: { userId: user.id, currency, balance: parseFloat(amount), lockedBalance: 0, isActive: true },
  });

  const reference = `OGA-CREDIT-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  await prisma.transaction.create({
    data: {
      userId: user.id,
      walletId: wallet.id,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      amount: parseFloat(amount),
      currency,
      reference,
      balanceBefore: parseFloat(wallet.balance) - parseFloat(amount),
      balanceAfter: parseFloat(wallet.balance),
      description: 'Manual wallet credit',
      completedAt: new Date(),
    },
  });

  successResponse(res, { email, amount, currency, newBalance: parseFloat(wallet.balance) });
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
// POST /api/v1/wallets/withdraw
router.post('/withdraw', requireKyc, validate(withdrawSchema), async (req, res) => {
  const { amount } = req.body;

  // Check withdrawal limit based on KYC level
  const kycTier = req.user?.kyc?.kycTier ?? 0;
  const MAX_WITHDRAWAL = kycTier >= 2 ? 20000 : (kycTier >= 1 ? 10000 : 0);

  if (Number(amount) > MAX_WITHDRAWAL) {
    throw ApiError.badRequest(`Withdrawal limit is ₦${MAX_WITHDRAWAL.toLocaleString()} for your KYC level. Upgrade to Level 2 (BVN) for higher limits.`);
  }

  const data = await walletService.initiateWithdrawal(req.user.id, req.body);
  successResponse(res, data, 'Withdrawal request submitted. Processing within 24 hours.');
});


module.exports = router;
