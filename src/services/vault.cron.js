'use strict';

const cron = require('node-cron');
const vaultService = require('./vault.service');
const { logger } = require('../utils/logger');

// ── Schedule vault distribution ─────────────────
// Runs every 12 hours (00:00 and 12:00 UTC) — matching WURK.fun schedule
const scheduleVaultDistribution = () => {
  if (process.env.NODE_ENV === 'test') return;

  cron.schedule('0 */12 * * *', async () => {
    logger.info('⏰ Vault distribution cron triggered (12-hour cycle)');
    try {
      const result = await vaultService.runDistribution();
      if (result.distributed) {
        logger.info(`✅ Vault distribution: $${result.totalNgp} to ${result.recipients} holders. Next: ${result.nextDistributionAt}`);
      } else {
        logger.info(`⏸ Vault distribution skipped: ${result.reason}`);
      }
    } catch (err) {
      logger.error(`❌ Vault distribution failed: ${err.message}`);
    }
  });

  logger.info('📅 Vault distribution cron scheduled: 0 */12 * * * (every 12 hours)');
};

module.exports = { scheduleVaultDistribution };
