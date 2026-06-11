'use strict';

const cron = require('node-cron');
const vaultService = require('./vault.service');
const { logger } = require('../utils/logger');

// ── Schedule vault distribution ─────────────────
// Runs every day at 00:00 UTC
const scheduleVaultDistribution = () => {
  if (process.env.NODE_ENV === 'test') return;

  cron.schedule('0 0 * * *', async () => {
    logger.info('⏰ Vault distribution cron triggered');
    try {
      const result = await vaultService.runDistribution();
      if (result.distributed) {
        logger.info(`✅ Vault distribution: ₦${result.totalNgp} to ${result.recipients} holders. Next: ${result.nextDistributionAt}`);
      } else {
        logger.info(`⏸ Vault distribution skipped: ${result.reason}`);
      }
    } catch (err) {
      logger.error(`❌ Vault distribution failed: ${err.message}`);
    }
  });

  logger.info('📅 Vault distribution cron scheduled: 0 0 * * * (daily midnight UTC)');
};

module.exports = { scheduleVaultDistribution };
