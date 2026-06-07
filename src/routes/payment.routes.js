'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const { prisma } = require('../config/database');
const { ApiError, successResponse, createdResponse } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');
const { logger } = require('../utils/logger');

const router = express.Router();

// POST /api/v1/payments/create — Create a payment intent
router.post('/create', authenticate, async (req, res) => {
  const { amount, currency = 'NGN', provider = 'AUTO', description, redirectUrl, metadata } = req.body;

  if (!amount || amount <= 0) throw ApiError.badRequest('Amount must be positive');
  if (!['NGN', 'USDC', 'USDT', 'SOL'].includes(currency)) {
    throw ApiError.badRequest('Unsupported currency. Use NGN, USDC, USDT, or SOL');
  }

  // Determine provider
  let resolvedProvider = provider;
  if (provider === 'AUTO') {
    resolvedProvider = currency === 'NGN' ? 'FLUTTERWAVE' : 'CRYPTO';
  }

  const reference = `OGA-PAY-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

  // Create the payment record
  const payment = await prisma.transaction.create({
    data: {
      userId: req.user.id,
      walletId: '', // Will be set on completion
      type: 'DEPOSIT',
      status: 'PENDING',
      amount,
      currency,
      reference,
      provider: resolvedProvider,
      balanceBefore: 0,
      balanceAfter: 0,
      description: description || `Deposit of ${amount} ${currency}`,
      metadata: {
        ...(metadata || {}),
        paymentReference: reference,
        redirectUrl: redirectUrl || `${process.env.FRONTEND_URL || 'https://ogapay.vercel.app'}/pay/${reference}`,
      },
    },
  });

  // Build provider-specific payment URL
  let paymentUrl = null;
  let paymentData = null;

  if (resolvedProvider === 'FLUTTERWAVE') {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, firstName: true, lastName: true, phone: true },
    });

    const axios = require('axios');
    const fwPayload = {
      tx_ref: reference,
      amount,
      currency: 'NGN',
      redirect_url: `${process.env.FRONTEND_URL || 'https://ogapay.vercel.app'}/pay/${reference}`,
      customer: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        phonenumber: user.phone || '',
      },
      customizations: {
        title: 'OgaPay Deposit',
        description: description || `Fund your OgaPay wallet`,
        logo: 'https://ogapay.vercel.app/logo.png',
      },
      meta: {
        userId: req.user.id,
        txId: payment.id,
        reference,
      },
    };

    const { data } = await axios.post('https://api.flutterwave.com/v3/payments', fwPayload, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
    });

    if (data.status !== 'success') throw ApiError.internal('Failed to initialize Flutterwave payment');
    paymentUrl = data.data.link;
    paymentData = { flutterwaveRef: data.data.id };
  }

  if (resolvedProvider === 'PAYSTACK') {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });

    const axios = require('axios');
    const { data } = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: amount * 100,
        reference,
        callback_url: `${process.env.FRONTEND_URL || 'https://ogapay.vercel.app'}/pay/${reference}`,
        metadata: { userId: req.user.id, txId: payment.id },
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
    );

    if (!data.status) throw ApiError.internal('Failed to initialize Paystack payment');
    paymentUrl = data.data.authorization_url;
  }

  if (resolvedProvider === 'CRYPTO') {
    const wallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: req.user.id, currency } },
    });
    paymentUrl = null; // Crypto deposits are done by sending to an address
    paymentData = {
      depositAddress: wallet?.walletAddress || process.env.PLATFORM_WALLET_ADDRESS,
      network: currency === 'SOL' ? 'Solana' : currency === 'USDC' ? 'Solana/Base' : 'Ethereum',
    };
  }

  await prisma.transaction.update({
    where: { id: payment.id },
    data: {
      metadata: { ...(paymentData || {}), ...((payment.metadata as any) || {}) },
    },
  });

  createdResponse(res, {
    reference,
    amount,
    currency,
    provider: resolvedProvider,
    paymentUrl,
    paymentData,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry
  }, 'Payment created');
});

// GET /api/v1/payments/:reference — Get payment details (public with reference)
router.get('/:reference', async (req, res) => {
  const payment = await prisma.transaction.findUnique({
    where: { reference: req.params.reference },
    include: {
      user: {
        select: { firstName: true, lastName: true, username: true, email: true },
      },
    },
  });

  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

  successResponse(res, {
    reference: payment.reference,
    amount: parseFloat(payment.amount),
    currency: payment.currency,
    provider: payment.provider,
    status: payment.status,
    description: payment.description,
    createdAt: payment.createdAt,
    completedAt: payment.completedAt,
    metadata: payment.metadata,
    user: payment.user ? {
      name: `${payment.user.firstName} ${payment.user.lastName}`,
      username: payment.user.username,
    } : null,
  }, 'Payment details fetched');
});

// POST /api/v1/payments/:reference/verify — Verify payment status
router.post('/:reference/verify', async (req, res) => {
  const payment = await prisma.transaction.findUnique({
    where: { reference: req.params.reference },
  });

  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

  // If already completed, return
  if (payment.status === 'COMPLETED') {
    return successResponse(res, {
      reference: payment.reference,
      status: 'COMPLETED',
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      completedAt: payment.completedAt,
    }, 'Payment already completed');
  }

  // If still pending and provider is CRYPTO, check dev mode manual confirm
  let currentStatus = payment.status;

  // For Flutterwave/Paystack — the webhook marks it complete.
  // If webhook hasn't fired yet, check provider API
  if (payment.status === 'PENDING' && payment.provider === 'FLUTTERWAVE') {
    try {
      const axios = require('axios');
      const { data } = await axios.get(
        `https://api.flutterwave.com/v3/transactions/by_reference/${payment.reference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } },
      );
      if (data.status === 'success' && data.data.status === 'successful') {
        await walletService.confirmDeposit(payment.reference, String(data.data.id));
        currentStatus = 'COMPLETED';
      }
    } catch (err) {
      logger.warn(`Flutterwave verify error for ${payment.reference}: ${err.message}`);
    }
  }

  if (payment.status === 'PENDING' && payment.provider === 'PAYSTACK') {
    try {
      const axios = require('axios');
      const { data } = await axios.get(
        `https://api.paystack.co/transaction/verify/${payment.reference}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
      );
      if (data.status && data.data.status === 'success') {
        await walletService.confirmDeposit(payment.reference, String(data.data.id));
        currentStatus = 'COMPLETED';
      }
    } catch (err) {
      logger.warn(`Paystack verify error for ${payment.reference}: ${err.message}`);
    }
  }

  successResponse(res, {
    reference: payment.reference,
    status: currentStatus,
    amount: parseFloat(payment.amount),
    currency: payment.currency,
  }, 'Payment status verified');
});

module.exports = router;
