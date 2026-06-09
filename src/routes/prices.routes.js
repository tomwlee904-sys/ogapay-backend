'use strict';

const express = require('express');
const axios = require('axios');
const { successResponse } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const router = express.Router();

// ── In-memory cache ─────────────────────────────
let cachedPrices = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Fallback prices ────────────────────────────
const FALLBACK_PRICES = {
  sol: { usd: 145, ngn: 230000 },
  usdc: { usd: 1, ngn: 1580 },
};

// ── Fetch from CoinGecko ──────────────────────
async function fetchPrices() {
  const now = Date.now();
  
  // Return cached if still fresh
  if (cachedPrices && (now - lastFetchTime) < CACHE_TTL_MS) {
    return { ...cachedPrices, stale: false };
  }

  try {
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd,ngn',
      { timeout: 5000 }
    );

    cachedPrices = {
      sol: { usd: data.solana.usd, ngn: data.solana.ngn },
      usdc: { usd: data['usd-coin'].usd, ngn: data['usd-coin'].ngn },
      updatedAt: new Date().toISOString(),
    };
    lastFetchTime = now;
    logger.info('Live prices fetched from CoinGecko');
    return { ...cachedPrices, stale: false };
  } catch (err) {
    logger.warn(`CoinGecko fetch failed: ${err.message}`);
    
    // Return stale cache if exists
    if (cachedPrices) {
      return { ...cachedPrices, stale: true };
    }
    
    // Return fallback
    logger.warn('No cached prices available — using fallback defaults');
    return {
      ...FALLBACK_PRICES,
      updatedAt: new Date().toISOString(),
      stale: true,
    };
  }
}

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
    result = numAmount * (prices.usdc.ngn); // approximate using USDC/NGN rate
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
