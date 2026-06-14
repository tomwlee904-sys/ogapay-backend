'use strict';

require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const cron = require('node-cron');
const taskService = require('./services/task.service');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const walletRoutes = require('./routes/wallet.routes');
const taskRoutes = require('./routes/task.routes');
const kycRoutes = require('./routes/kyc.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const storeRoutes = require('./routes/store.routes');
const webhookRoutes = require('./routes/webhook.routes');
const notificationRoutes = require('./routes/notification.routes');
const communityRoutes = require('./routes/community.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const uploadRoutes = require('./routes/upload.routes');
const aiRoutes = require('./routes/ai.routes');
// Phase 5+6 routes
const apikeyRoutes = require('./routes/apikey.routes');
const campaignRoutes = require('./routes/campaign.routes');
const serviceRoutes = require('./routes/service.routes');
const wurkerRoutes = require('./routes/wurker.routes');
const bookmarkRoutes = require('./routes/bookmark.routes');
const reportRoutes = require('./routes/report.routes');
const editrequestRoutes = require('./routes/editrequest.routes');
const communityV2Routes = require('./routes/community-v2.routes');
const escrowRoutes = require('./routes/escrow.routes');
const paymentRoutes = require('./routes/payment.routes');
const platformRoutes = require('./routes/platform.routes');
const jobRoutes = require('./routes/job.routes');
const pricesRoutes = require('./routes/prices.routes');
const messageRoutes = require('./routes/message.routes');
const vaultRoutes = require('./routes/vault.routes');
const vaultAdminRoutes = require('./routes/vault-admin.routes');
const blogRoutes = require('./routes/blog.routes');
const twitterRoutes = require('./routes/twitter.routes');
const deviceRoutes = require('./routes/device.routes');
const linksRoutes = require('./routes/links.routes');

const app = express();
app.set('trust proxy', 1);
const API = `/api/${process.env.API_VERSION || 'v1'}`;
const API_ALIAS = `/${process.env.API_VERSION || 'v1'}`;

// ── Security Middleware ────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'https://ogapay-five.vercel.app',
    'https://ogapay.vercel.app',
    'https://ogapay.io',
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Rate Limiting ──────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Please wait before trying again.' },
});

app.use(globalLimiter);

// ── Body Parsing ──────────────────────────────
// Raw body for webhooks MUST come before json()
app.use(`${API}/webhooks`, express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}

// ── Health Check ──────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ogapay-api',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Cron: Auto-complete expired cooldowns every 15 min ──
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const count = await taskService.autoCompleteExpiredCooldowns();
      if (count > 0) logger.info(`Auto-completed ${count} expired cooldown tasks`);
    } catch (err) {
      logger.error(`Cooldown cron error: ${err.message}`);
    }
  });
  logger.info('Cooldown cron scheduled: */15 * * * *');
  const { scheduleVaultDistribution } = require('./services/vault.cron');
  scheduleVaultDistribution();
}

// ── API Routes ────────────────────────────────
function mountRoutes(base) {
  app.use(`${base}/auth`, authLimiter, authRoutes);
  app.use(`${base}/users`, userRoutes);
  app.use(`${base}/wallet`, walletRoutes);
  app.use(`${base}/wallets`, walletRoutes);
  app.use(`${base}/tasks`, taskRoutes);
  app.use(`${base}/kyc`, kycRoutes);
  app.use(`${base}/leaderboard`, leaderboardRoutes);
  app.use(`${base}/store`, storeRoutes);
  app.use(`${base}/communities`, communityV2Routes);
  app.use(`${base}/communities`, communityRoutes);
  app.use(`${base}/dashboard`, dashboardRoutes);
  app.use(`${base}/uploads`, uploadRoutes);
  app.use(`${base}/ai`, aiRoutes);
  app.use(`${base}/webhooks`, webhookRoutes);
  app.use(`${base}/notifications`, notificationRoutes);
  app.use(`${base}/escrow`, escrowRoutes);
  app.use(`${base}/payments`, paymentRoutes);
  app.use(`${base}/campaigns`, campaignRoutes);
  app.use(`${base}/platform`, platformRoutes);
  app.use(`${base}/stats`, platformRoutes);
  app.use(`${base}/jobs`, jobRoutes);
  app.use(`${base}/prices`, pricesRoutes);
  app.use(`${base}/messages`, messageRoutes);
  app.use(`${base}/vault/admin`, vaultAdminRoutes);
  app.use(`${base}/vault`, vaultRoutes);
  app.use(`${base}/blog`, blogRoutes);
  app.use(`${base}/twitter`, twitterRoutes);
  app.use(`${base}/devices`, deviceRoutes);
  app.use(`${base}/links`, linksRoutes);
  app.use(`${base}/wurker`, wurkerRoutes);
  app.use(`${base}/apikeys`, apikeyRoutes);
  app.use(`${base}/services`, serviceRoutes);
  app.use(`${base}/bookmarks`, bookmarkRoutes);
  app.use(`${base}/reports`, reportRoutes);
  app.use(`${base}/editrequests`, editrequestRoutes);
}
mountRoutes(API);
mountRoutes(API_ALIAS);

// GET /api/v1/rates — Currency rates for frontend
const axios = require('axios');
app.get(`${API}/rates`, async (req, res) => {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd,ngn', { timeout: 5000 });
    res.json({ success: true, data: { SOL: data.solana.usd, USDC: data['usd-coin'].usd, NGN: data['usd-coin'].ngn, updatedAt: new Date().toISOString() } });
  } catch {
    res.json({ success: true, data: { SOL: 145, USDC: 1, NGN: 1580, updatedAt: new Date().toISOString() } });
  }
});
app.get(`${API_ALIAS}/rates`, async (req, res) => {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd,ngn', { timeout: 5000 });
    res.json({ success: true, data: { SOL: data.solana.usd, USDC: data['usd-coin'].usd, NGN: data['usd-coin'].ngn, updatedAt: new Date().toISOString() } });
  } catch {
    res.json({ success: true, data: { SOL: 145, USDC: 1, NGN: 1580, updatedAt: new Date().toISOString() } });
  }
});

// Serve the website from the same deployment as the API.
// API routes above keep `/v1/*` and `/api/v1/*` live; everything else can be static HTML.
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.get('/pay/:reference', (req, res) => {
  res.sendFile(path.join(publicDir, 'pay.html'));
});

// ── 404 & Error Handlers ──────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────
const PORT = process.env.PORT || 5000;

let server;

if (require.main === module) {
  server = app.listen(PORT, () => {
  logger.info(`🚀 OgaPay API running on port ${PORT} [${process.env.NODE_ENV}]`);
  logger.info(`📍 API Base: ${API}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  if (!server) return;
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (server) server.close(() => process.exit(1));
});

module.exports = app;

