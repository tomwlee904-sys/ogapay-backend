'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');
const { createNotification, NOTIF_TYPES } = require('../utils/notify');

const router = express.Router();

router.use(authenticate);

const requireAdmin = async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw ApiError.forbidden('Admin access required');
  next();
};

// GET /admin/moderation/queue — submissions flagged for 24h+ without review
router.get('/moderation/queue', requireAdmin, async (req, res) => {
  const flagged = await prisma.taskSubmission.findMany({
    where: { flaggedForModeration: true, status: 'SUBMITTED' },
    include: {
      task: { select: { id: true, title: true, reward: true, currency: true, posterId: true } },
      worker: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
    },
    orderBy: { flaggedAt: 'asc' },
  });

  const total = flagged.length;
  const pending = flagged.filter(s => !s.moderatedAt).length;

  successResponse(res, { queue: flagged, total, pending });
});

// POST /admin/moderation/resolve/:submissionId — moderator approves or rejects
router.post('/moderation/resolve/:submissionId', requireAdmin, async (req, res) => {
  const { submissionId } = req.params;
  const { action, posterNotes, rating, feedback } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(action)) throw ApiError.badRequest('Action must be APPROVED or REJECTED');

  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { task: true },
  });
  if (!submission) throw ApiError.notFound('Submission not found');
  if (!submission.flaggedForModeration) throw ApiError.badRequest('Submission not flagged for moderation');
  if (submission.moderatedAt) throw ApiError.badRequest('Submission already moderated');

  const now = new Date();
  const updateData = {
    status: action,
    posterNotes: posterNotes || submission.posterNotes,
    rating: rating || submission.rating,
    feedback: feedback || submission.feedback,
    reviewedAt: now,
    moderatedById: req.user.id,
    moderatedAt: now,
    ...(action === 'APPROVED' && { paidAt: now }),
  };

  const result = await prisma.$transaction(async (db) => {
    // Guarded: a second click (or a poster review at the same moment) can't pay twice
    const { count } = await db.taskSubmission.updateMany({
      where: { id: submissionId, status: 'SUBMITTED', moderatedAt: null },
      data: updateData,
    });
    if (count === 0) throw ApiError.conflict('Submission was already reviewed');

    const { releaseEscrow, completeTaskIfResolved } = require('../services/escrow.service');
    if (action === 'APPROVED') {
      await releaseEscrow(
        submission.taskId,
        submission.workerId,
        parseFloat(submission.task.reward),
        submission.task.currency,
        submissionId,
        db,
      );
    }
    await completeTaskIfResolved(db, submission.taskId);

    return db.taskSubmission.findUnique({ where: { id: submissionId } });
  });

  successResponse(res, { id: result.id, status: result.status }, `Submission ${action.toLowerCase()} by moderator`);
});

// POST /admin/moderation/flag-expired — manually trigger the 24h check
router.post('/moderation/flag-expired', requireAdmin, async (req, res) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const expired = await prisma.taskSubmission.findMany({
    where: {
      status: 'SUBMITTED',
      submittedAt: { lte: cutoff },
      flaggedForModeration: false,
    },
    select: { id: true },
  });

  if (expired.length === 0) {
    return successResponse(res, { flagged: 0 }, 'No expired submissions to flag');
  }

  await prisma.taskSubmission.updateMany({
    where: { id: { in: expired.map(s => s.id) } },
    data: { flaggedForModeration: true, flaggedAt: new Date() },
  });

  successResponse(res, { flagged: expired.length }, `Flagged ${expired.length} expired submissions`);
});

// ── Withdrawals ────────────────────────────────
// Bank withdrawals from /wallet/withdraw only hold the user's money. An admin
// pays the transfer by hand, then marks it paid (the money leaves the wallet)
// or rejects it (the hold is released). Each can be settled once: the status
// change from PROCESSING is the guard, shared with the Flutterwave webhook.

const metaOf = (tx) => (tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {});

// manual: held, paid by an admin · flutterwave: held, transfer sent automatically
// crypto: already debited and broadcast, confirmation not seen yet
const withdrawalKind = (tx) => {
  const meta = metaOf(tx);
  if (String(tx.reference).startsWith('OGA-WIT-CRYPTO')) return 'crypto';
  if (meta.flutterwaveId || String(tx.description || '').startsWith('Withdrawal to ')) return 'flutterwave';
  return 'manual';
};

const fmtAmount = (amount, currency) => (currency === 'NGN'
  ? `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
  : `${Number(amount)} ${currency}`);

// GET /admin/withdrawals?status=PROCESSING|COMPLETED|FAILED&page=1
router.get('/withdrawals', requireAdmin, async (req, res) => {
  const status = ['PROCESSING', 'COMPLETED', 'FAILED'].includes(req.query.status) ? req.query.status : 'PROCESSING';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const take = 50;
  const where = { type: 'WITHDRAWAL', status };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: status === 'PROCESSING' ? 'asc' : 'desc' },
      skip: (page - 1) * take,
      take,
      include: {
        user: {
          select: {
            id: true, email: true, firstName: true, lastName: true, username: true,
            kyc: { select: { status: true, kycTier: true } },
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  const items = rows.map((tx) => {
    const meta = metaOf(tx);
    const amount = Number(tx.amount);
    const fee = Number(tx.fee || 0);
    return {
      id: tx.id,
      reference: tx.reference,
      kind: withdrawalKind(tx),
      status: tx.status,
      amount,
      fee,
      payout: meta.netAmount != null ? Number(meta.netAmount) : amount - fee,
      currency: tx.currency,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
      externalRef: tx.externalRef,
      destination: {
        bankName: meta.bankName || null,
        bankCode: meta.bankCode || null,
        accountNumber: meta.accountNumber || null,
        accountName: meta.accountName || null,
        address: meta.toAddress || meta.walletAddress || null,
      },
      settledAt: meta.settledAt || null,
      note: meta.settleNote || meta.rejectReason || meta.error || null,
      user: tx.user && {
        id: tx.user.id,
        email: tx.user.email,
        name: [tx.user.firstName, tx.user.lastName].filter(Boolean).join(' ') || tx.user.username,
        kycTier: tx.user.kyc?.status === 'APPROVED' ? tx.user.kyc.kycTier : 0,
      },
    };
  });

  const pending = status === 'PROCESSING'
    ? await prisma.transaction.groupBy({ by: ['currency'], where, _sum: { amount: true }, _count: true })
    : [];

  successResponse(res, {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
    totals: pending.map((g) => ({ currency: g.currency, count: g._count, amount: Number(g._sum.amount || 0) })),
  });
});

const findWithdrawal = async (id) => {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.type !== 'WITHDRAWAL') throw ApiError.notFound('Withdrawal not found');
  if (tx.status !== 'PROCESSING') throw ApiError.conflict(`This withdrawal is already ${tx.status.toLowerCase()}`);
  return tx;
};

// POST /admin/withdrawals/:id/approve  { payoutRef?, note? }
// Call after the money has been sent (bank transfer done, or tx seen on-chain).
router.post('/withdrawals/:id/approve', requireAdmin, async (req, res) => {
  const payoutRef = String(req.body?.payoutRef || '').trim().slice(0, 190);
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const tx = await findWithdrawal(req.params.id);
  const kind = withdrawalKind(tx);
  const now = new Date();

  await prisma.$transaction(async (db) => {
    const { count } = await db.transaction.updateMany({
      where: { id: tx.id, status: 'PROCESSING' },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        ...(payoutRef && { externalRef: payoutRef }),
        metadata: { ...metaOf(tx), settledBy: req.user.id, settledAt: now.toISOString(), ...(note && { settleNote: note }) },
      },
    });
    if (count === 0) throw ApiError.conflict('This withdrawal was already settled');

    // Crypto was debited before it was sent; bank withdrawals were only held, so
    // the money now leaves the balance as well as the hold.
    if (kind !== 'crypto') {
      await db.wallet.update({
        where: { id: tx.walletId },
        data: { balance: { decrement: tx.amount }, lockedBalance: { decrement: tx.amount } },
      });
    }

    await db.auditLog.create({
      data: {
        userId: tx.userId,
        action: 'withdrawal_approved',
        description: `${tx.reference} marked paid by admin ${req.user.id}`,
        amount: tx.amount,
        currency: tx.currency,
        reference: tx.reference,
        metadata: { adminId: req.user.id, kind, payoutRef: payoutRef || null, note: note || null },
      },
    });

    await createNotification({
      userId: tx.userId,
      type: NOTIF_TYPES.WITHDRAWAL_SUCCESS,
      title: 'Withdrawal paid',
      body: `Your withdrawal of ${fmtAmount(tx.amount, tx.currency)} has been paid.`,
      data: { txId: tx.id, reference: tx.reference },
      db,
    });
  });

  successResponse(res, { id: tx.id, status: 'COMPLETED' }, 'Withdrawal marked as paid');
});

// POST /admin/withdrawals/:id/reject  { reason }
// Nothing was sent: the money goes back to the user's available balance.
router.post('/withdrawals/:id/reject', requireAdmin, async (req, res) => {
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  if (!reason) throw ApiError.badRequest('Give a reason. The user will see it.');
  const tx = await findWithdrawal(req.params.id);
  const kind = withdrawalKind(tx);
  const now = new Date();

  await prisma.$transaction(async (db) => {
    const { count } = await db.transaction.updateMany({
      where: { id: tx.id, status: 'PROCESSING' },
      data: {
        status: 'FAILED',
        metadata: { ...metaOf(tx), settledBy: req.user.id, settledAt: now.toISOString(), rejectReason: reason },
      },
    });
    if (count === 0) throw ApiError.conflict('This withdrawal was already settled');

    if (kind === 'crypto') {
      // Debited before sending; only reject once you've confirmed it never landed
      await db.wallet.update({ where: { id: tx.walletId }, data: { balance: { increment: tx.amount } } });
    } else {
      await db.wallet.update({ where: { id: tx.walletId }, data: { lockedBalance: { decrement: tx.amount } } });
    }

    await db.auditLog.create({
      data: {
        userId: tx.userId,
        action: 'withdrawal_rejected',
        description: `${tx.reference} rejected by admin ${req.user.id}: ${reason}`,
        amount: tx.amount,
        currency: tx.currency,
        reference: tx.reference,
        metadata: { adminId: req.user.id, kind, reason },
      },
    });

    await createNotification({
      userId: tx.userId,
      type: NOTIF_TYPES.WITHDRAWAL_FAILED,
      title: 'Withdrawal not completed',
      body: `Your withdrawal of ${fmtAmount(tx.amount, tx.currency)} was not completed: ${reason}. The money is back in your wallet.`,
      data: { txId: tx.id, reference: tx.reference, reason },
      db,
    });
  });

  successResponse(res, { id: tx.id, status: 'FAILED' }, 'Withdrawal rejected and funds returned');
});

module.exports = router;
