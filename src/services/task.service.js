'use strict';

const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');
const { lockFundsForTask, releaseEscrow } = require('./wallet.service');
const { logger } = require('../utils/logger');

// ── Create Task ────────────────────────────────

const createTask = async (posterId, taskData) => {
  const { reward, currency, maxWorkers, ...rest } = taskData;

  // Lock the worker rewards in escrow and charge the platform fee once.
  const taskSubtotal = reward * maxWorkers;
  const escrowResult = await lockFundsForTask(posterId, 'PENDING', taskSubtotal, currency);
  const platformFee = escrowResult.fee;
  const totalCost = escrowResult.escrowed;

  const task = await prisma.$transaction(async (db) => {
    const newTask = await db.task.create({
      data: {
        posterId,
        reward,
        currency,
        maxWorkers,
        ...rest,
        status: 'OPEN',
        escrowed: true,
        escrowTxId: escrowResult.txId,
        platformFee,
        expiresAt: rest.deadline ? new Date(rest.deadline) : null,
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

  const where = {
    status,
    ...(category && { category }),
    ...(currency && { currency }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(minReward && { reward: { gte: minReward } }),
    ...(maxReward && { reward: { lte: maxReward } }),
  };

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

const applyToTask = async (workerId, taskId) => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw ApiError.notFound('Task not found');
  if (task.status !== 'OPEN') throw ApiError.badRequest(`Task is ${task.status.toLowerCase()}, not accepting applications`);
  if (task.posterId === workerId) throw ApiError.badRequest('You cannot apply to your own task');
  if (task.currentWorkers >= task.maxWorkers) throw ApiError.badRequest('Task has reached maximum workers');

  const existing = await prisma.taskSubmission.findUnique({
    where: { taskId_workerId: { taskId, workerId } },
  });
  if (existing) throw ApiError.conflict('You have already applied to this task');

  const submission = await prisma.$transaction(async (db) => {
    const sub = await db.taskSubmission.create({
      data: { taskId, workerId, startedAt: new Date() },
    });

    await db.task.update({
      where: { id: taskId },
      data: {
        currentWorkers: { increment: 1 },
        submissionsCount: { increment: 1 },
      },
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

  // Trigger cooldown if all slots filled
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
  if (submission.status !== 'PENDING') throw ApiError.badRequest(`Submission already ${submission.status.toLowerCase()}`);

const updated = await prisma.$transaction(async (db) => {
    const sub = await db.taskSubmission.update({
      where: { id: submission.id },
      data: { proof, workerNotes, attachments, submittedAt: new Date(), status: 'SUBMITTED' },
    });

    await db.notification.create({
      data: {
        userId: submission.task.posterId,
        type: 'TASK_SUBMISSION',
        title: '📬 Task submitted for review',
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
  if (submission.status !== 'SUBMITTED') throw ApiError.badRequest('Submission not ready for review');
  if (!submission.submittedAt) throw ApiError.badRequest('Worker has not submitted yet');

  return prisma.$transaction(async (db) => {
    const updated = await db.taskSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        posterNotes,
        rating,
        feedback,
        reviewedAt: new Date(),
        ...(status === 'APPROVED' && { paidAt: new Date() }),
      },
    });

    if (status === 'APPROVED') {
      // Release payment to worker
      await releaseEscrow(
        submission.taskId,
        submission.workerId,
        parseFloat(submission.task.reward),
        submission.task.currency,
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

    // Check if all slots filled and all submissions resolved → mark task COMPLETED, refund remaining escrow
    if (submission.task.maxWorkers <= submission.task.currentWorkers) {
      const resolvedCount = await db.taskSubmission.count({
        where: { taskId: submission.taskId, status: { in: ['APPROVED', 'REJECTED'] } },
      });
      if (resolvedCount >= submission.task.maxWorkers) {
        const totalLocked = parseFloat(submission.task.reward) * submission.task.maxWorkers;
        const approvedCount = await db.taskSubmission.count({
          where: { taskId: submission.taskId, status: 'APPROVED' },
        });
        const paidAmount = parseFloat(submission.task.reward) * approvedCount;
        const remaining = totalLocked - paidAmount;

        if (remaining > 0) {
          const posterWallet = await db.wallet.findUnique({
            where: { userId_currency: { userId: submission.task.posterId, currency: submission.task.currency } },
          });
          await db.wallet.update({
            where: { id: posterWallet.id },
            data: {
              lockedBalance: { decrement: remaining },
              balance: { increment: remaining },
            },
          });
        }

        await db.task.update({
          where: { id: submission.taskId },
          data: { status: 'COMPLETED', escrowed: false },
        });
      }
    }

    return updated;
  }, { timeout: 20000 });
};

// ── Cooldown Trigger ────────────────────────────

const triggerCooldownIfFull = async (task, taskId) => {
  const pendingCount = await prisma.taskSubmission.count({
    where: { taskId, status: { in: ['PENDING', 'SUBMITTED'] } },
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
  if (!['SUBMITTED', 'PENDING'].includes(submission.status)) throw ApiError.badRequest('Submission cannot be rejected');

  return prisma.$transaction(async (db) => {
    const updated = await db.taskSubmission.update({
      where: { id: submissionId },
      data: { status: 'REJECTED', reviewedAt: new Date(), posterNotes: posterNotes || undefined },
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

const autoCompleteExpiredCooldowns = async () => {
  const expired = await prisma.task.findMany({
    where: {
      status: 'COOLING_DOWN',
      cooldownStartedAt: {
        lte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  for (const task of expired) {
    await prisma.$transaction(async (db) => {
      await db.taskSubmission.updateMany({
        where: { taskId: task.id, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });

      await db.task.update({
        where: { id: task.id },
        data: { status: 'COMPLETED' },
      });

      await db.notification.create({
        data: {
          userId: task.posterId,
          type: 'COOLDOWN_EXPIRED',
          title: '⏰ Cooldown Expired',
          body: `Cooldown expired for "${task.title}". Pending submissions auto-approved.`,
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
