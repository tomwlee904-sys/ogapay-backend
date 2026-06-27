'use strict';

const express = require('express');
const crypto = require('crypto');
const { confirmDeposit } = require('../services/wallet.service');
const flutterwaveService = require('../services/flutterwave.service');
const { logger } = require('../utils/logger');

const router = express.Router();

// Note: these routes receive raw body (configured in index.js)

// ── Paystack Webhook ───────────────────────────
router.post('/paystack', async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    logger.warn('Invalid Paystack webhook signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  logger.info(`Paystack webhook: ${event.event}`, { ref: event.data?.reference });

  res.status(200).json({ received: true });

  try {
    if (event.event === 'charge.success') {
      const { reference } = event.data;
      await confirmDeposit(reference, event.data.id);
    }
  } catch (err) {
    logger.error('Paystack webhook processing error:', err.message);
  }
});

// ── Flutterwave Webhook ────────────────────────
router.post('/flutterwave', async (req, res) => {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  const signature = req.headers['verif-hash'];

  if (!signature || signature !== secretHash) {
    logger.warn('Invalid Flutterwave webhook signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  logger.info(`Flutterwave webhook: ${event.event}`, { ref: event.data?.tx_ref });

  res.status(200).json({ received: true });

  try {
    if (event.event === 'charge.completed' && event.data.status === 'successful') {
      const reference = event.data.tx_ref;
      await confirmDeposit(reference, String(event.data.id));
    } else if (event.event === 'va.credit_notification') {
      await flutterwaveService.handleDvaCredit(event);
    } else if (event.event === 'transfer.completed') {
      await flutterwaveService.handleTransferUpdate(event);
    }
  } catch (err) {
    logger.error('Flutterwave webhook processing error:', err.message);
  }
});

module.exports = router;
