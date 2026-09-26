'use strict';

// Email alerts behind Settings → Notifications. In-app notifications are
// created all over the code; this reads the committed rows afterwards (so a
// rolled-back action never sends an email) and emails the ones the user asked for.
const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');
const { sendEmail, buildAlertEmail } = require('./email.service');
const { effectivePreferences } = require('./user.service');

// Notification type -> Settings switch
const CATEGORY_OF = {};
const categories = {
  taskAlerts: ['TASK_APPLICATION', 'TASK_SUBMISSION', 'SUBMISSION_REVIEWED', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED',
    'SLOT_REOPENED', 'SLOT_EXPIRED', 'DISPUTE_OPENED', 'DIRECT_HIRE', 'COOLDOWN', 'COOLDOWN_EXPIRED', 'STORE_ORDER_UPDATE'],
  payoutAlerts: ['TASK_PAYMENT_RECEIVED', 'TRANSFER_RECEIVED', 'REFERRAL_BONUS', 'SIGNUP_BONUS', 'ESCROW_REFUNDED',
    'TASK_REFUND', 'STORE_PURCHASE', 'DEPOSIT_CONFIRMED', 'WITHDRAWAL_SUCCESS', 'WITHDRAWAL_FAILED'],
  communityAlerts: ['COMMUNITY_INVITE', 'JOIN_REQUEST', 'JOIN_REQUEST_APPROVED'],
  // Account notices go out whenever email alerts are on
  account: ['KYC_APPROVED', 'KYC_REJECTED'],
};
for (const [cat, types] of Object.entries(categories)) types.forEach((t) => { CATEGORY_OF[t] = cat; });

const linkFor = (n, cat) => {
  const d = (n.data && typeof n.data === 'object') ? n.data : {};
  if (cat === 'taskAlerts') return d.taskId ? `/tasks/${d.taskId}` : '/my-tasks';
  if (cat === 'payoutAlerts') return '/wallet';
  if (cat === 'communityAlerts') return d.communityId ? `/communities/${d.communityId}` : '/communities';
  if (cat === 'account') return '/settings/verification';
  return '/notifications';
};

// Whether this user wants this email, from their saved settings
const wants = (user, cat) => {
  if (!user || user.isBanned || !user.isEmailVerified || !user.email || user.email.startsWith('deleted_')) return false;
  const prefs = effectivePreferences(user.preferences);
  if (user.emailNotifications === false || !prefs.emailNotifications) return false;
  return cat === 'account' ? true : !!prefs[cat];
};

const USER_FIELDS = { email: true, firstName: true, isEmailVerified: true, isBanned: true, emailNotifications: true, preferences: true };

// Every 2 minutes: notifications from the last 30 minutes that haven't been
// looked at yet. Each row is claimed before sending, so it goes out at most once.
async function dispatchEmailAlerts({ now = new Date(), windowMinutes = 30, limit = 200, send = sendEmail } = {}) {
  const rows = await prisma.notification.findMany({
    where: { emailedAt: null, createdAt: { gte: new Date(now.getTime() - windowMinutes * 60000) } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { user: { select: USER_FIELDS } },
  });
  let sent = 0;
  for (const n of rows) {
    const { count } = await prisma.notification.updateMany({ where: { id: n.id, emailedAt: null }, data: { emailedAt: now } });
    if (!count) continue;
    const cat = CATEGORY_OF[n.type];
    if (!cat || n.isRead || !wants(n.user, cat)) continue;
    try {
      const email = buildAlertEmail({ name: n.user.firstName, title: n.title, body: n.body, link: linkFor(n, cat) });
      await send({ to: n.user.email, ...email });
      sent++;
    } catch (e) {
      logger.warn(`Alert email failed for notification ${n.id}: ${e.message}`);
    }
  }
  return { scanned: rows.length, sent };
}

const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-US');

// Daily: new open jobs from the last 24 hours in the categories on the worker's
// profile, for people who turned on "New job alerts"
async function sendNewJobAlerts({ now = new Date(), send = sendEmail } = {}) {
  const jobs = await prisma.task.findMany({
    where: { status: 'OPEN', hiredWorkerId: null, createdAt: { gte: new Date(now.getTime() - 86400000) } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, title: true, reward: true, currency: true, category: true, posterId: true },
  });
  if (!jobs.length) return { sent: 0 };
  const cats = [...new Set(jobs.map((j) => j.category))];
  const workers = await prisma.user.findMany({
    where: {
      isBanned: false, isEmailVerified: true, emailNotifications: true,
      preferences: { path: ['newTaskAlerts'], equals: true },
      workerProfile: { categories: { hasSome: cats } },
    },
    take: 2000,
    select: { id: true, ...USER_FIELDS, workerProfile: { select: { categories: true } } },
  });
  let sent = 0;
  for (const w of workers) {
    if (!wants(w, 'newTaskAlerts')) continue;
    const mine = jobs.filter((j) => j.posterId !== w.id && (w.workerProfile?.categories || []).includes(j.category)).slice(0, 5);
    if (!mine.length) continue;
    const lines = mine.map((j) => `• ${j.title} (${j.currency === 'NGN' ? naira(j.reward) : `${Number(j.reward)} ${j.currency}`})`).join('\n');
    const email = buildAlertEmail({
      name: w.firstName,
      title: `${mine.length} new job${mine.length === 1 ? '' : 's'} for you`,
      body: `New jobs in your categories from the last 24 hours:\n\n${lines}`,
      link: '/tasks',
      cta: 'See jobs',
    });
    try { await send({ to: w.email, ...email }); sent++; } catch (e) { logger.warn(`Job alert failed for ${w.id}: ${e.message}`); }
  }
  return { sent };
}

// Mondays: what you earned from jobs last week, for people who turned on the summary
async function sendWeeklySummaries({ now = new Date(), send = sendEmail } = {}) {
  const since = new Date(now.getTime() - 7 * 86400000);
  const earned = await prisma.transaction.groupBy({
    by: ['userId'],
    where: { type: 'TASK_PAYMENT', status: 'COMPLETED', currency: 'NGN', taskId: { not: null }, createdAt: { gte: since } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  if (!earned.length) return { sent: 0 };
  const users = await prisma.user.findMany({
    where: { id: { in: earned.map((e) => e.userId) }, preferences: { path: ['weeklyDigest'], equals: true } },
    select: { id: true, ...USER_FIELDS },
  });
  const byId = new Map(earned.map((e) => [e.userId, e]));
  let sent = 0;
  for (const u of users) {
    if (!wants(u, 'weeklyDigest')) continue;
    const e = byId.get(u.id);
    const email = buildAlertEmail({
      name: u.firstName,
      title: `You earned ${naira(e._sum.amount)} last week`,
      body: `You were paid for ${e._count._all} job${e._count._all === 1 ? '' : 's'} in the last 7 days, a total of ${naira(e._sum.amount)}.`,
      link: '/analytics',
      cta: 'See your analytics',
    });
    try { await send({ to: u.email, ...email }); sent++; } catch (err) { logger.warn(`Weekly summary failed for ${u.id}: ${err.message}`); }
  }
  return { sent };
}

function scheduleAlerts() {
  const cron = require('node-cron');
  const run = (name, fn) => async () => {
    try {
      const r = await fn();
      if (r?.sent) logger.info(`${name}: ${r.sent} email(s) sent`);
    } catch (e) {
      logger.error(`${name} cron error: ${e.message}`);
    }
  };
  cron.schedule('*/2 * * * *', run('Email alerts', () => dispatchEmailAlerts()));
  cron.schedule('0 8 * * *', run('New job alerts', () => sendNewJobAlerts()), { timezone: 'Africa/Lagos' });
  cron.schedule('0 8 * * 1', run('Weekly summaries', () => sendWeeklySummaries()), { timezone: 'Africa/Lagos' });
  logger.info('Email alert crons scheduled (alerts every 2 min, job alerts 08:00 daily, summaries Mondays 08:00 Lagos)');
}

module.exports = { CATEGORY_OF, dispatchEmailAlerts, sendNewJobAlerts, sendWeeklySummaries, scheduleAlerts };
