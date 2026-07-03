'use strict';

// Regenerate Prisma client on every start to pick up schema changes
try {
  require('child_process').execSync('npx prisma generate', {
    stdio: 'pipe',
    cwd: __dirname + '/../..',
    timeout: 30000,
  });
} catch (e) {
  // Non-fatal: continue with existing client
}

const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Query: ${e.query} — ${e.duration}ms`);
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma error:', e.message || e);
});

module.exports = { prisma };
