'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

// Days and months are bucketed on Lagos time (UTC+1, no daylight saving)
const LAGOS_MS = 60 * 60 * 1000;
const DAY_MS = 86400000;
const lagosDay = (d) => new Date(new Date(d).getTime() + LAGOS_MS).toISOString().slice(0, 10);
const lagosMonth = (d) => lagosDay(d).slice(0, 7);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buckets(period) {
  const now = Date.now();
  if (period === 'year') {
    const out = [];
    const today = new Date(now + LAGOS_MS);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
      out.push({ key: d.toISOString().slice(0, 7), label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
    }
    const first = out[0].key;
    return { list: out, since: new Date(Date.parse(`${first}-01T00:00:00Z`) - LAGOS_MS), keyOf: lagosMonth };
  }
  const days = period === 'month' ? 30 : 7;
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = lagosDay(now - i * DAY_MS);
    const d = new Date(`${key}T00:00:00Z`);
    out.push({ key, label: days === 7 ? DAYS[d.getUTCDay()] : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` });
  }
  return { list: out, since: new Date(Date.parse(`${out[0].key}T00:00:00Z`) - LAGOS_MS), keyOf: lagosDay };
}

// GET /api/v1/analytics?period=week|month|year - the signed-in user's own numbers.
// Earnings are naira paid for jobs (not deposits or escrow); spending is naira the
// user's own jobs paid out to workers.
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const period = ['week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'week';
  const { list, since, keyOf } = buckets(period);
  const paid = { type: 'TASK_PAYMENT', status: 'COMPLETED', taskId: { not: null }, createdAt: { gte: since } };

  // Workers are paid with COMPLETED TASK_PAYMENT lines; a poster's own escrow line
  // stays PENDING, so these are the user's job earnings only.
  const myTaskIds = (await prisma.task.findMany({ where: { posterId: userId }, select: { id: true } })).map((t) => t.id);
  const notMine = myTaskIds.length ? { taskId: { not: null, notIn: myTaskIds } } : {};
  const [earned, spent, reviewed, workerProfile, recent] = await Promise.all([
    prisma.transaction.findMany({
      where: { ...paid, userId, ...notMine },
      select: { amount: true, currency: true, createdAt: true },
    }),
    myTaskIds.length
      ? prisma.transaction.findMany({
          where: { ...paid, userId: { not: userId }, taskId: { in: myTaskIds } },
          select: { amount: true, currency: true, createdAt: true },
        })
      : [],
    prisma.taskSubmission.groupBy({
      by: ['status'],
      where: { workerId: userId, reviewedAt: { gte: since }, status: { in: ['APPROVED', 'REJECTED'] } },
      _count: { _all: true },
    }),
    prisma.workerProfile.findUnique({ where: { userId }, select: { avgRating: true, totalRatings: true } }),
    prisma.transaction.findMany({
      where: { type: 'TASK_PAYMENT', status: 'COMPLETED', userId, taskId: { not: null }, ...notMine },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, amount: true, currency: true, createdAt: true, taskId: true },
    }),
  ]);
  const titles = new Map((await prisma.task.findMany({
    where: { id: { in: [...new Set(recent.map((t) => t.taskId))] } },
    select: { id: true, title: true },
  })).map((t) => [t.id, t.title]));

  const rows = new Map(list.map((b) => [b.key, { label: b.label, jobs: 0, earnedNgn: 0, spentNgn: 0 }]));
  for (const t of earned) {
    const row = rows.get(keyOf(t.createdAt));
    if (!row) continue;
    row.jobs += 1;
    if (t.currency === 'NGN') row.earnedNgn += Number(t.amount);
  }
  for (const t of spent) {
    const row = rows.get(keyOf(t.createdAt));
    if (row && t.currency === 'NGN') row.spentNgn += Number(t.amount);
  }
  const series = [...rows.values()].map((r) => ({ ...r, earnedNgn: Math.round(r.earnedNgn * 100) / 100, spentNgn: Math.round(r.spentNgn * 100) / 100 }));

  const approved = reviewed.find((r) => r.status === 'APPROVED')?._count._all || 0;
  const rejected = reviewed.find((r) => r.status === 'REJECTED')?._count._all || 0;
  const sum = (k) => series.reduce((a, r) => a + r[k], 0);

  successResponse(res, {
    period,
    totals: {
      jobsPaid: earned.length,
      earnedNgn: Math.round(sum('earnedNgn') * 100) / 100,
      otherCurrencyJobs: earned.filter((t) => t.currency !== 'NGN').length,
      spentNgn: Math.round(sum('spentNgn') * 100) / 100,
      approvalRate: approved + rejected ? Math.round((approved / (approved + rejected)) * 100) : null,
      reviewed: approved + rejected,
      avgRating: workerProfile?.totalRatings ? Math.round(Number(workerProfile.avgRating) * 10) / 10 : null,
      ratings: workerProfile?.totalRatings || 0,
    },
    series,
    recent: recent.map((t) => ({ id: t.id, amount: Number(t.amount), currency: t.currency, at: t.createdAt, task: { id: t.taskId, title: titles.get(t.taskId) || 'Job' } })),
  });
});

module.exports = router;
