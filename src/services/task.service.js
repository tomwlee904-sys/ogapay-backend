'use strict';

const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');
const { lockFundsForTask, logTaskFee, releaseEscrow, completeTaskIfResolved } = require('./escrow.service');
const { logger } = require('../utils/logger');

// ── Create Task ────────────────────────────────

const createTask = async (posterId, taskData) => {
  const { reward, currency, maxWorkers, title, description, category, instructions, deadline, proofRequired, tags, estimatedTime, trackingCode, attachments, status: _, ...extra } = taskData;

  // Lock the worker rewards in escrow and charge the platform fee once, in the
  // same transaction as the task insert: if anything below fails, no money moves.
  const taskSubtotal = reward * maxWorkers;

  const task = await prisma.$transaction(async (db) => {
    const escrowResult = await lockFundsForTask(posterId, 'PENDING', taskSubtotal, currency, db);
    const platformFee = escrowResult.fee;
    const totalCost = escrowResult.escrowed;

    const newTask = await db.task.create({
      data: {
        posterId,
        reward,
        currency,
        maxWorkers,
        title,
        description,
        category,
        ...(instructions && { instructions }),
        ...(deadline && { deadline: new Date(deadline) }),
        ...(proofRequired && { proofRequired }),
        ...(tags && { tags }),
        ...(estimatedTime && { estimatedTime }),
        ...(taskData.minSorsaScore !== undefined && { minSorsaScore: taskData.minSorsaScore }),
        ...(taskData.minRank !== undefined && { minRank: taskData.minRank }),
        ...(taskData.requiresLinkedin !== undefined && { requiresLinkedin: taskData.requiresLinkedin }),
        ...(taskData.requiresWallet !== undefined && { requiresWallet: taskData.requiresWallet }),
        ...(taskData.workerRequirement && { workerRequirement: taskData.workerRequirement }),
        ...(trackingCode && { trackingCode }),
        ...(taskData.requiresX !== undefined && { requiresX: taskData.requiresX }),
        ...(attachments?.length && { attachments }),
        status: 'OPEN',
        escrowed: true,
        escrowTxId: escrowResult.txId,
        platformFee,
        expiresAt: deadline ? new Date(deadline) : null,
      },
    });

    // Update escrow tx with actual taskId
    await db.transaction.update({
      where: { id: escrowResult.txId },
      data: { taskId: newTask.id },
    });

    await db.posterProfile.update({
      where: { userId: posterId },
      data: { totalPosted: { increment: 1 }, totalSpent: { increment: totalCost } },
    });

    return newTask;
  });

  logTaskFee(task.id, Number(task.platformFee), currency);
  logger.info(`Task created: ${task.id} by poster ${posterId}`);

  // Notify workers whose categories match this task
  try {
    const category = task.category;
    if (category) {
      const matchingWorkers = await prisma.workerProfile.findMany({
        where: { categories: { has: category }, isAvailable: true },
        select: { userId: true },
      });
      await Promise.all(matchingWorkers.map(w =>
        prisma.notification.create({
          data: {
            userId: w.userId,
            type: 'NEW_TASK',
            title: 'New task available in your category',
            body: `"${task.title}" — ₦${Number(task.reward).toLocaleString()} · ${category}`,
            data: { taskId: task.id, category },
          },
        })
      ));
    }
  } catch (err) {
    logger.warn(`Failed to notify workers about new task ${task.id}: ${err.message}`);
  }

  return task;
};

// ── List Tasks ─────────────────────────────────

const listTasks = async ({ category, status = 'OPEN', page = 1, limit = 20, search, currency, minReward, maxReward, sortBy = 'createdAt', sortOrder = 'desc' }) => {
  const skip = (page - 1) * limit;

  const now = new Date();
  const where = {};
  if (status === 'ACTIVE') {
    where.status = { in: ['OPEN', 'COOLING_DOWN'] };
  } else {
    where.status = status;
  }

  // Expired tasks excluded from OPEN/ACTIVE listings
  const andClauses = [];
  if (status === 'OPEN' || status === 'ACTIVE') {
    andClauses.push({ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] });
  }

  if (category) where.category = category;
  if (currency) where.currency = currency;

  if (search) {
    andClauses.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (minReward) where.reward = { ...where.reward, gte: minReward };
  if (maxReward) where.reward = { ...where.reward, lte: maxReward };
  if (andClauses.length > 0) where.AND = andClauses;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        poster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            posterProfile: { select: { avgRating: true, isVerified: true, totalPosted: true } },
          },
        },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total };
};

// ── Get Task ───────────────────────────────────

const getTask = async (taskId, userId) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      poster: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          firstName: true,
          lastName: true,
          posterProfile: { select: { avgRating: true, isVerified: true } },
        },
      },
      _count: { select: { submissions: true } },
    },
  });

  if (!task) throw ApiError.notFound('Task not found');

  // Override status to EXPIRED if deadline has passed and task is still OPEN
  const now = new Date();
  const isExpired = task.expiresAt && new Date(task.expiresAt) < now;
  if (isExpired && task.status === 'OPEN') {
    task.status = 'EXPIRED';
  }

  // Check if current user has already applied
  let userSubmission = null;
  if (userId) {
    userSubmission = await prisma.taskSubmission.findUnique({
      where: { taskId_workerId: { taskId, workerId: userId } },
    });
    // Increment view count (debounced in production with Redis)
    await prisma.task.update({ where: { id: taskId }, data: { views: { increment: 1 } } });
  }

  return { task, userSubmission };
};

// ── Apply to Task ──────────────────────────────

// ── Job requirements ───────────────────────────

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'LEGEND'];
const LEVEL_NAMES = ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Legend'];

// Refuse an application when the worker doesn't meet what the poster asked for,
// and say exactly what's missing.
const checkWorkerRequirements = async (task, workerId) => {
  const needRank = Math.min(Number(task.minRank) || 0, 5);
  const needScore = Number(task.minSorsaScore) || 0;
  if (!task.workerRequirement && needRank <= 1 && needScore <= 0 && !task.requiresWallet && !task.requiresX) return;

  const worker = await prisma.user.findUnique({
    where: { id: workerId },
    select: {
      humanVerifiedAt: true,
      ogaScore: true,
      walletAddress: true,
      twitterOAuthConnected: true,
      kyc: { select: { status: true } },
      workerProfile: { select: { level: true } },
      wallets: { where: { currency: 'SOL', walletAddress: { not: null } }, select: { id: true }, take: 1 },
    },
  });

  const missing = [];
  let fixInSettings = false;
  const need = (text, settable) => { missing.push(text); fixInSettings = fixInSettings || settable; };
  if (task.workerRequirement === 'KYC' && worker?.kyc?.status !== 'APPROVED') need('verified KYC', true);
  if (task.workerRequirement === 'HUMAN' && !worker?.humanVerifiedAt) need('human verification with VeryAI', true);
  if (needScore > 0 && (worker?.ogaScore || 0) < needScore) need(`an OgaScore of ${needScore} (yours is ${worker?.ogaScore || 0})`, false);
  if (task.requiresWallet && !worker?.walletAddress && !worker?.wallets?.length) need('a connected Solana wallet', true);
  if (task.requiresX && !worker?.twitterOAuthConnected) need('a connected X account', true);
  if (needRank > 1) {
    const have = Math.max(0, LEVELS.indexOf(worker?.workerProfile?.level || 'BEGINNER')) + 1;
    if (have < needRank) need(`${LEVEL_NAMES[needRank - 1]} rank or higher (you're ${LEVEL_NAMES[have - 1]})`, false);
  }

  if (missing.length) {
    throw ApiError.forbidden(`This job needs ${missing.join(', ')}.${fixInSettings ? ' You can set these up in Settings.' : ''}`);
  }
};

const applyToTask = async (workerId, taskId) => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw ApiError.notFound('Task not found');
  if (task.status !== 'OPEN') throw ApiError.badRequest(`Task is ${task.status.toLowerCase()}, not accepting applications`);
  if (task.expiresAt && new Date(task.expiresAt) < new Date()) throw ApiError.badRequest('Task has expired');
  if (task.posterId === workerId) throw ApiError.badRequest('You cannot apply to your own task');
  await checkWorkerRequirements(task, workerId);

  const submission = await prisma.$transaction(async (db) => {
    // Atomic capacity check inside the transaction
    const { count: capCheck } = await db.task.updateMany({
      where: { id: taskId, currentWorkers: { lt: task.maxWorkers } },
      data: { currentWorkers: { increment: 1 } },
    });
    if (capCheck === 0) throw ApiError.badRequest('Task has reached maximum workers');

    // Atomic duplicate check — try to create, let unique constraint serve as final guard
    const existing = await db.taskSubmission.findUnique({
      where: { taskId_workerId: { taskId, workerId } },
    });
    if (existing && existing.status !== 'EXPIRED') throw ApiError.conflict('You have already applied to this task');
    // Lost the slot earlier for not submitting: a fresh application replaces it
    if (existing) await db.taskSubmission.delete({ where: { id: existing.id } });

    const sub = await db.taskSubmission.create({
      data: { taskId, workerId, startedAt: new Date() },
    });

    await db.task.update({
      where: { id: taskId },
      data: { submissionsCount: { increment: 1 } },
    });

    await db.notification.create({
      data: {
        userId: task.posterId,
        type: 'TASK_APPLICATION',
        title: '👤 New worker applied',
        body: `Someone applied to your task: "${task.title}"`,
        data: { taskId, submissionId: sub.id },
      },
    });

    return sub;
  });

  // Trigger cooldown if all slots filled (re-query fresh count inside)
  await triggerCooldownIfFull(task, taskId);

  return submission;
};

// ── Submit Task ────────────────────────────────

const submitTask = async (workerId, taskId, { proof, workerNotes, attachments }) => {
  const submission = await prisma.taskSubmission.findUnique({
    where: { taskId_workerId: { taskId, workerId } },
    include: { task: true },
  });

  if (!submission) throw ApiError.notFound('Submission not found. Apply to the task first.');
  if (!['OPEN', 'COOLING_DOWN'].includes(submission.task.status)) throw ApiError.badRequest(`Task is ${submission.task.status.toLowerCase()}, submissions closed`);
  if (submission.task.expiresAt && new Date(submission.task.expiresAt) < new Date()) throw ApiError.badRequest('Task has expired');
  if (submission.status !== 'PENDING') throw ApiError.badRequest(`Submission already ${submission.status.toLowerCase()}`);

  // Normalize input values
  const normalizedProof = (proof && typeof proof === 'string') ? proof.trim() : ''
  const normalizedNotes = (workerNotes && typeof workerNotes === 'string') ? workerNotes.trim() : ''
  const normalizedAttachments = Array.isArray(attachments) ? attachments.filter(Boolean) : []

  // Auto-set proof fallback when attachments exist but no link was provided
  let finalProof = normalizedProof
  if (!finalProof && normalizedAttachments.length > 0) {
    finalProof = 'Proof attached'
  }

  // Require at least one of proof, notes, or attachments
  if (!finalProof && !normalizedNotes && normalizedAttachments.length === 0) {
    throw ApiError.badRequest('Please provide a proof link, note, or upload at least one screenshot/file.')
  }

  const updated = await prisma.$transaction(async (db) => {
    const sub = await db.taskSubmission.update({
      where: { id: submission.id },
      data: {
        proof: finalProof || null,
        workerNotes: normalizedNotes || null,
        attachments: normalizedAttachments,
        submittedAt: new Date(),
        status: 'SUBMITTED',
      },
    });

    await db.notification.create({
      data: {
        userId: submission.task.posterId,
        type: 'TASK_SUBMISSION',
        title: 'Task submitted for review',
        body: `A worker submitted their work for: "${submission.task.title}"`,
        data: { taskId, submissionId: submission.id },
      },
    });

    return sub;
  });

  return updated;
};

// ── Review Submission ──────────────────────────

const reviewSubmission = async (posterId, submissionId, { status, posterNotes, rating, feedback }) => {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { task: true },
  });

  if (!submission) throw ApiError.notFound('Submission not found');
  if (submission.task.posterId !== posterId) throw ApiError.forbidden('Not your task');
  if (!submission.submittedAt) throw ApiError.badRequest('Worker has not submitted yet');

  return prisma.$transaction(async (db) => {
    const { count } = await db.taskSubmission.updateMany({
      where: { id: submissionId, status: 'SUBMITTED' },
      data: {
        status,
        posterNotes,
        rating,
        feedback,
        reviewedAt: new Date(),
      },
    });

    if (count === 0) {
      throw ApiError.conflict('Submission was already reviewed');
    }

    const updated = await db.taskSubmission.findUnique({
      where: { id: submissionId },
    });

    if (status === 'APPROVED') {
      // Release payment to worker (uses tx for atomicity)
      await releaseEscrow(
        submission.taskId,
        submission.workerId,
        parseFloat(submission.task.reward),
        submission.task.currency,
        submissionId,
        db,
      );

      // Update worker reputation
      if (rating) {
        const workerProfile = await db.workerProfile.findUnique({ where: { userId: submission.workerId } });
        const newTotal = workerProfile.totalRatings + 1;
        const newAvg = ((workerProfile.avgRating * workerProfile.totalRatings) + rating) / newTotal;
        const successRate = (workerProfile.tasksCompleted + 1) / (workerProfile.tasksCompleted + workerProfile.tasksRejected + 1) * 100;

        await db.workerProfile.update({
          where: { userId: submission.workerId },
          data: {
            avgRating: newAvg,
            totalRatings: newTotal,
            reputationScore: calculateReputation(newAvg, successRate, workerProfile.tasksCompleted + 1),
            level: calculateLevel(workerProfile.tasksCompleted + 1, newAvg),
          },
        });
      }

      // Notify worker
      await db.notification.create({
        data: {
          userId: submission.workerId,
          type: 'SUBMISSION_APPROVED',
          title: '✅ Submission Approved!',
          body: `Your work was approved! Payment has been sent to your wallet.`,
          data: { taskId: submission.taskId, submissionId },
        },
      });
    }

    if (status === 'REJECTED') {
      await db.workerProfile.update({
        where: { userId: submission.workerId },
        data: { tasksRejected: { increment: 1 } },
      });

      await db.notification.create({
        data: {
          userId: submission.workerId,
          type: 'SUBMISSION_REJECTED',
          title: '❌ Submission Rejected',
          body: posterNotes || 'Your submission was rejected. Please review the feedback.',
          data: { taskId: submission.taskId, submissionId, reason: posterNotes },
        },
      });

      // Reopen slot: decrement filled counts, set task back to OPEN
      await db.task.update({
        where: { id: submission.taskId },
        data: {
          currentWorkers: { decrement: 1 },
          submissionsCount: { decrement: 1 },
          status: 'OPEN',
        },
      });

      // Notify first waitlisted worker about the reopened slot
      const next = await db.waitlist.findFirst({
        where: { taskId: submission.taskId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await db.notification.create({
          data: {
            userId: next.userId,
            type: 'SLOT_REOPENED',
            title: '🎯 Slot Reopened!',
            body: `A slot opened up for "${submission.task.title}" — apply now!`,
            data: { taskId: submission.taskId },
          },
        });
      }
    }

    // All slots taken and nothing left to review → complete the task and
    // return the unused escrow (released from the hold, not credited again)
    await completeTaskIfResolved(db, submission.taskId);

    // Notify poster about the review decision
    if (status === 'APPROVED') {
      await db.notification.create({
        data: {
          userId: submission.task.posterId,
          type: 'SUBMISSION_REVIEWED',
          title: '✅ Submission Approved',
          body: `You approved a submission for "${submission.task.title}". Payment has been released.`,
          data: { taskId: submission.taskId, submissionId, workerId: submission.workerId },
        },
      });
    } else if (status === 'REJECTED') {
      await db.notification.create({
        data: {
          userId: submission.task.posterId,
          type: 'SUBMISSION_REVIEWED',
          title: '❌ Submission Rejected',
          body: `You rejected a submission for "${submission.task.title}".`,
          data: { taskId: submission.taskId, submissionId, workerId: submission.workerId },
        },
      });
    }

    return updated;
  }, { timeout: 20000 });
};

// ── Cooldown Trigger ────────────────────────────

const triggerCooldownIfFull = async (task, taskId) => {
  const pendingCount = await prisma.taskSubmission.count({
    where: { taskId, status: 'PENDING' },
  });

  if (pendingCount >= task.maxWorkers && task.status === 'OPEN') {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COOLING_DOWN',
        cooldownStartedAt: new Date(),
      },
    });
    await prisma.notification.create({
      data: {
        userId: task.posterId,
        type: 'COOLDOWN',
        title: '⏳ Task Cooling Down',
        body: `Your task "${task.title}" is now cooling down. Review and approve submissions.`,
        data: { taskId, message: 'cooldown' },
      },
    });
  }
};

// ── Featured Tasks ──────────────────────────────

const getFeaturedTasks = async () => {
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ['OPEN', 'COOLING_DOWN'] },
      featured: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    include: {
      poster: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          createdAt: true,
          posterProfile: { select: { avgRating: true, isVerified: true, totalPosted: true } },
        },
      },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return tasks;
};

// ── Join Waitlist ───────────────────────────────

const joinWaitlist = async (userId, taskId) => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw ApiError.notFound('Task not found');
  if (task.status !== 'COOLING_DOWN') throw ApiError.badRequest('Task is not in cooldown');

  const existing = await prisma.waitlist.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) throw ApiError.conflict('Already on waitlist');

  await prisma.waitlist.create({ data: { taskId, userId } });

  const position = await prisma.waitlist.count({ where: { taskId } });

  return { position };
};

// ── Reject Submission ───────────────────────────

const rejectSubmission = async (posterId, submissionId, { posterNotes }) => {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { task: true },
  });

  if (!submission) throw ApiError.notFound('Submission not found');
  if (submission.task.posterId !== posterId) throw ApiError.forbidden('Not your task');
  return prisma.$transaction(async (db) => {
    const { count } = await db.taskSubmission.updateMany({
      where: { id: submissionId, status: { in: ['SUBMITTED', 'PENDING'] } },
      data: { status: 'REJECTED', reviewedAt: new Date(), posterNotes: posterNotes || undefined },
    });

    if (count === 0) {
      throw ApiError.conflict('Submission was already reviewed or cannot be rejected');
    }

    const updated = await db.taskSubmission.findUnique({
      where: { id: submissionId },
    });

    await db.workerProfile.update({
      where: { userId: submission.workerId },
      data: { tasksRejected: { increment: 1 } },
    });

    await db.notification.create({
      data: {
        userId: submission.workerId,
        type: 'SUBMISSION_REJECTED',
        title: '❌ Submission Rejected',
        body: posterNotes || 'Your submission was rejected.',
        data: { taskId: submission.taskId, submissionId, reason: posterNotes },
      },
    });

    // Reopen slot
    await db.task.update({
      where: { id: submission.taskId },
      data: {
        currentWorkers: { decrement: 1 },
        submissionsCount: { decrement: 1 },
        status: 'OPEN',
        featured: submission.task.featured,
      },
    });

    // Notify first waitlisted worker
    const next = await db.waitlist.findFirst({
      where: { taskId: submission.taskId },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await db.notification.create({
        data: {
          userId: next.userId,
          type: 'SLOT_REOPENED',
          title: '🎯 Slot Reopened!',
          body: `A slot opened up for "${submission.task.title}" — apply now!`,
          data: { taskId: submission.taskId },
        },
      });
      await db.waitlist.delete({ where: { id: next.id } });
    }

    return updated;
  });
};

// ── Auto-Complete Expired Cooldowns ─────────────

// Once every slot is taken the task cools down for 24 hours. When that ends,
// applicants who still haven't submitted anything lose their slot so others
// can take it; submitted work goes through normal review (and the 24h
// moderation queue), and the task completes through completeTaskIfResolved.
// (This used to mark unsubmitted work approved and "paid" without paying.)
const autoCompleteExpiredCooldowns = async () => {
  const expired = await prisma.task.findMany({
    where: {
      status: 'COOLING_DOWN',
      cooldownStartedAt: {
        lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, posterId: true, title: true },
  });

  for (const task of expired) {
    await prisma.$transaction(async (db) => {
      const { count } = await db.task.updateMany({
        where: { id: task.id, status: 'COOLING_DOWN' },
        data: { status: 'OPEN' },
      });
      if (count === 0) return;

      const stale = await db.taskSubmission.findMany({
        where: { taskId: task.id, status: 'PENDING', submittedAt: null },
        select: { id: true, workerId: true },
      });
      if (stale.length) {
        const { count: released } = await db.taskSubmission.updateMany({
          where: { id: { in: stale.map((s) => s.id) }, status: 'PENDING', submittedAt: null },
          data: { status: 'EXPIRED', reviewedAt: new Date(), posterNotes: 'Slot released: no work submitted within 24 hours' },
        });
        await db.task.update({
          where: { id: task.id },
          data: { currentWorkers: { decrement: released }, submissionsCount: { decrement: released } },
        });
        await db.notification.createMany({
          data: stale.map((s) => ({
            userId: s.workerId,
            type: 'SLOT_EXPIRED',
            title: 'Your slot was released',
            body: `You didn't submit work for "${task.title}" within 24 hours, so your slot is open to others. Apply again if a slot is free.`,
            data: { taskId: task.id },
          })),
        });
      }

      if (await completeTaskIfResolved(db, task.id)) return;
      await db.notification.create({
        data: {
          userId: task.posterId,
          type: 'COOLDOWN_EXPIRED',
          title: '⏰ Cooldown Ended',
          body: stale.length
            ? `${stale.length} applicant${stale.length === 1 ? '' : 's'} didn't submit in time for "${task.title}", so ${stale.length === 1 ? 'that slot is' : 'those slots are'} open again. Review the submitted work to pay your workers.`
            : `Cooldown ended for "${task.title}". Review the submitted work to pay your workers.`,
          data: { taskId: task.id },
        },
      });
    });
  }

  return expired.length;
};

// ── Helpers ────────────────────────────────────

const calculateReputation = (avgRating, successRate, tasksCompleted) => {
  const ratingScore = avgRating * 20;       // max 100
  const successScore = successRate * 0.5;   // max 50
  const experienceScore = Math.min(tasksCompleted * 2, 50); // max 50
  return Math.min(Math.round(ratingScore + successScore + experienceScore), 200);
};

const calculateLevel = (tasksCompleted, avgRating) => {
  if (tasksCompleted >= 500 && avgRating >= 4.8) return 'LEGEND';
  if (tasksCompleted >= 200 && avgRating >= 4.5) return 'EXPERT';
  if (tasksCompleted >= 50 && avgRating >= 4.0) return 'ADVANCED';
  if (tasksCompleted >= 10) return 'INTERMEDIATE';
  return 'BEGINNER';
};

module.exports = {
  createTask,
  listTasks,
  getTask,
  applyToTask,
  submitTask,
  reviewSubmission,
  triggerCooldownIfFull,
  getFeaturedTasks,
  joinWaitlist,
  rejectSubmission,
  autoCompleteExpiredCooldowns,
};
