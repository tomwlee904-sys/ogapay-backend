'use strict';

const express = require('express');
const { successResponse } = require('../utils/apiResponse');
const { fetchPrices } = require('../services/price.service');

const router = express.Router();

// ── GET /api/v1/prices ─────────────────────────
router.get('/', async (req, res) => {
  const prices = await fetchPrices();
  successResponse(res, prices);
});

// ── GET /api/v1/prices/convert ─────────────────
router.get('/convert', async (req, res) => {
  const { amount, from, to } = req.query;

  if (!amount || !from || !to) {
    return res.status(400).json({
      success: false,
      message: 'Required: amount, from, to (e.g. ?amount=5000&from=NGN&to=SOL)',
    });
  }

  const prices = await fetchPrices();
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  let result;
  if (fromUpper === 'NGN' && toUpper === 'SOL') {
    result = numAmount / prices.sol.ngn;
  } else if (fromUpper === 'NGN' && toUpper === 'USDC') {
    result = numAmount / prices.usdc.ngn;
  } else if (fromUpper === 'SOL' && toUpper === 'NGN') {
    result = numAmount * prices.sol.ngn;
  } else if (fromUpper === 'USDC' && toUpper === 'NGN') {
    result = numAmount * prices.usdc.ngn;
  } else if (fromUpper === 'SOL' && toUpper === 'USD') {
    result = numAmount * prices.sol.usd;
  } else if (fromUpper === 'USDC' && toUpper === 'USD') {
    result = numAmount * prices.usdc.usd;
  } else if (fromUpper === 'USD' && toUpper === 'NGN') {
    result = numAmount * (prices.usdc.ngn);
  } else if (fromUpper === 'NGN' && toUpper === 'USD') {
    result = numAmount / prices.usdc.ngn;
  } else {
    return res.status(400).json({
      success: false,
      message: `Unsupported conversion: ${fromUpper} → ${toUpper}. Supported: NGN, USD, SOL, USDC`,
    });
  }

  successResponse(res, {
    from: fromUpper,
    to: toUpper,
    amount: numAmount,
    result: parseFloat(result.toFixed(8)),
    rate: fromUpper === 'NGN' ? 1 / (toUpper === 'SOL' ? prices.sol.ngn : prices.usdc.ngn) : (toUpper === 'NGN' ? prices.sol.ngn : prices.sol.usd),
    stale: prices.stale || false,
    updatedAt: prices.updatedAt,
  });
});

module.exports = router;
