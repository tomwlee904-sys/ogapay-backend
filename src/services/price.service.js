'use strict';

const axios = require('axios');
const { logger } = require('../utils/logger');

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

module.exports = { fetchPrices, FALLBACK_PRICES };
