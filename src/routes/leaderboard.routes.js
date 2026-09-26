'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const router = express.Router();

// Boards rank public, unbanned users only. Amounts are shown only for users who
// turned on "Show earnings"; everyone else appears with their count alone.
//   earners   - naira paid to the worker for jobs (count = paid jobs)
//   posters   - naira the poster paid out to workers (count = workers paid)
//   referrers - referred users who went on to complete a job
const BOARDS = ['earners', 'posters', 'referrers'];
const PERIOD_DAYS = { week: 7, month: 30, all: null };
const CACHE_MS = 60 * 1000;
const cache = new Map();

const pickBoard = (v) => (BOARDS.includes(v) ? v : 'earners');
const pickPeriod = (v) => (v in PERIOD_DAYS ? v : 'all');
const periodStart = (period) => {
  const days = PERIOD_DAYS[period];
  return days ? new Date(Date.now() - days * 86400000) : new Date(0);
};

// One row per user with a value on this board, best first.
// `onlyUserId` limits it to one user (used for a private user's own position).
async function boardRows(board, since, category, onlyUserId = null) {
  const cat = category || null;
  const one = onlyUserId || null;
  let rows;
  if (board === 'posters') {
    rows = await prisma.$queryRaw`
      SELECT k.poster_id AS id,
             COALESCE(SUM(t.amount) FILTER (WHERE t.currency::text = 'NGN'), 0)::float8 AS amount,
             COUNT(*)::int AS count
      FROM transactions t
      JOIN tasks k ON k.id = t.task_id
      JOIN users u ON u.id = k.poster_id
      WHERE t.type::text = 'TASK_PAYMENT' AND t.status::text = 'COMPLETED'
        AND t.user_id <> k.poster_id AND t.created_at >= ${since}
        AND (${cat}::text IS NULL OR k.category::text = ${cat}::text)
        AND (${one}::text IS NULL OR k.poster_id = ${one}::text)
        AND (${one}::text IS NOT NULL OR (u.is_public = true AND u.is_banned = false))
      GROUP BY k.poster_id
      ORDER BY amount DESC, count DESC, k.poster_id`;
  } else if (board === 'referrers') {
    rows = await prisma.$queryRaw`
      SELECT r.referrer_id AS id, 0::float8 AS amount, COUNT(*)::int AS count
      FROM referrals r
      JOIN users u ON u.id = r.referrer_id
      JOIN users v ON v.id = r.referred_id
      WHERE r.first_task_completed_at IS NOT NULL AND r.first_task_completed_at >= ${since}
        AND v.is_banned = false
        AND (${one}::text IS NULL OR r.referrer_id = ${one}::text)
        AND (${one}::text IS NOT NULL OR (u.is_public = true AND u.is_banned = false))
      GROUP BY r.referrer_id
      ORDER BY count DESC, r.referrer_id`;
  } else {
    rows = await prisma.$queryRaw`
      SELECT t.user_id AS id,
             COALESCE(SUM(t.amount) FILTER (WHERE t.currency::text = 'NGN'), 0)::float8 AS amount,
             COUNT(*)::int AS count
      FROM transactions t
      JOIN tasks k ON k.id = t.task_id
      JOIN users u ON u.id = t.user_id
      WHERE t.type::text = 'TASK_PAYMENT' AND t.status::text = 'COMPLETED'
        AND t.user_id <> k.poster_id AND t.created_at >= ${since}
        AND (${cat}::text IS NULL OR k.category::text = ${cat}::text)
        AND (${one}::text IS NULL OR t.user_id = ${one}::text)
        AND (${one}::text IS NOT NULL OR (u.is_public = true AND u.is_banned = false))
      GROUP BY t.user_id
      ORDER BY amount DESC, count DESC, t.user_id`;
  }
  return rows.map((r) => ({ id: r.id, amount: Number(r.amount) || 0, count: Number(r.count) || 0 }));
}

// Platform-wide totals for the period (everyone, not just public profiles)
async function periodTotals(since) {
  const [row] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(t.amount) FILTER (WHERE t.currency::text = 'NGN'), 0)::float8 AS paid,
           COUNT(*)::int AS jobs,
           COUNT(DISTINCT t.user_id)::int AS earners
    FROM transactions t
    JOIN tasks k ON k.id = t.task_id
    WHERE t.type::text = 'TASK_PAYMENT' AND t.status::text = 'COMPLETED'
      AND t.user_id <> k.poster_id AND t.created_at >= ${since}`;
  return { paidNgn: Number(row?.paid) || 0, jobsPaid: Number(row?.jobs) || 0, earners: Number(row?.earners) || 0 };
}

async function loadBoard(board, period, category) {
  const key = `${board}|${period}|${category || ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const since = periodStart(period);
  const [rows, totals] = await Promise.all([boardRows(board, since, category), periodTotals(since)]);
  const value = { rows, totals };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Position a user would hold: everyone strictly ahead of them, plus one
const rankOf = (rows, mine) =>
  rows.filter((r) => r.amount > mine.amount || (r.amount === mine.amount && r.count > mine.count)).length + 1;

const showsEarnings = (u) => (u?.preferences && typeof u.preferences === 'object' && u.preferences.showEarnings === true);

// GET /api/v1/leaderboard?board=earners|posters|referrers&period=week|month|all&category=&limit=
router.get('/', async (req, res) => {
  const board = pickBoard(req.query.board || (req.query.type === 'posters' ? 'posters' : undefined));
  const period = pickPeriod(req.query.period);
  const category = typeof req.query.category === 'string' && /^[A-Z_]{2,40}$/.test(req.query.category) ? req.query.category : null;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const { rows, totals } = await loadBoard(board, period, category);
  const top = rows.slice(0, limit);
  const users = top.length
    ? await prisma.user.findMany({
        where: { id: { in: top.map((r) => r.id) } },
        select: {
          id: true, firstName: true, lastName: true, username: true, avatarUrl: true, preferences: true,
          workerProfile: { select: { level: true } },
        },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  const entries = top.map((r, i) => {
    const u = byId.get(r.id);
    return {
      rank: i + 1,
      id: r.id,
      name: `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.username || 'OgaPay user',
      username: u?.username || null,
      avatarUrl: u?.avatarUrl || null,
      level: u?.workerProfile?.level || null,
      amount: board !== 'referrers' && showsEarnings(u) ? r.amount : null,
      count: r.count,
    };
  });

  successResponse(res, {
    board,
    period,
    category,
    totals,
    entries,
    // Older clients (worker workspace) read these names
    topEarners: entries.map((e) => ({ rank: e.rank, name: e.name, username: e.username, avatarUrl: e.avatarUrl, earnings: e.amount, tasks: e.count })),
  });
});

// GET /api/v1/leaderboard/me?board=&period= - the signed-in user's own position
router.get('/me', authenticate, async (req, res) => {
  const board = pickBoard(req.query.board);
  const period = pickPeriod(req.query.period);
  const { rows } = await loadBoard(board, period, null);

  let mine = rows.find((r) => r.id === req.user.id);
  let listed = !!mine;
  if (!mine) {
    // Private (or not yet ranked) users still see where they would stand
    [mine] = await boardRows(board, periodStart(period), null, req.user.id);
  }
  const [profile, me] = await Promise.all([
    prisma.workerProfile.findUnique({
      where: { userId: req.user.id },
      select: { totalEarned: true, tasksCompleted: true, reputationScore: true, level: true },
    }),
    prisma.user.findUnique({ where: { id: req.user.id }, select: { isPublic: true, preferences: true } }),
  ]);

  successResponse(res, {
    board,
    period,
    rank: mine && (mine.amount > 0 || mine.count > 0) ? (listed ? rows.indexOf(mine) + 1 : rankOf(rows, mine)) : null,
    amount: mine?.amount || 0,
    count: mine?.count || 0,
    listed,
    isPublic: me?.isPublic !== false,
    showEarnings: showsEarnings(me),
    ranked: rows.length,
    profile: profile && {
      totalEarned: Number(profile.totalEarned || 0),
      tasksCompleted: profile.tasksCompleted,
      reputationScore: profile.reputationScore,
      level: profile.level,
    },
  }, 'Your rank fetched');
});

// GET /api/v1/leaderboard/workers - public worker profiles by reputation
router.get('/workers', async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const validSort = ['reputationScore', 'tasksCompleted', 'avgRating'];
  const orderField = validSort.includes(req.query.sortBy) ? req.query.sortBy : 'reputationScore';
  const where = { user: { isPublic: true, isBanned: false } };

  const [workers, total] = await Promise.all([
    prisma.workerProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderField]: 'desc' },
      select: {
        level: true, reputationScore: true, tasksCompleted: true, avgRating: true, totalRatings: true,
        user: { select: { id: true, username: true, firstName: true, avatarUrl: true, createdAt: true } },
      },
    }),
    prisma.workerProfile.count({ where }),
  ]);

  const ranked = workers.map((w, idx) => ({ rank: skip + idx + 1, ...w }));
  paginatedResponse(res, ranked, paginate(page, limit, total), 'Leaderboard fetched');
});

// GET /api/v1/leaderboard/top-earners - this week's top earners (older clients)
router.get('/top-earners', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const { rows } = await loadBoard('earners', 'week', null);
  const top = rows.slice(0, limit);
  const users = await prisma.user.findMany({
    where: { id: { in: top.map((r) => r.id) } },
    select: { id: true, username: true, firstName: true, avatarUrl: true, preferences: true, workerProfile: { select: { level: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  successResponse(res, top.map((r) => {
    const { preferences, ...u } = byId.get(r.id) || {};
    return { ...u, weeklyEarnings: showsEarnings({ preferences }) ? r.amount : null, weeklyJobs: r.count };
  }), 'Top earners fetched');
});

module.exports = router;
