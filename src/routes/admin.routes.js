'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');

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
    const updated = await db.taskSubmission.update({
      where: { id: submissionId },
      data: updateData,
    });

    if (action === 'APPROVED') {
      const { releaseEscrow } = require('../services/escrow.service');
      await releaseEscrow(
        submission.taskId,
        submission.workerId,
        parseFloat(submission.task.reward),
        submission.task.currency,
      );
    }

    return updated;
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

module.exports = router;
