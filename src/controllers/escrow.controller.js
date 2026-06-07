'use strict';

const escrowService = require('../services/escrow.service');
const taskService = require('../services/task.service');
const { prisma } = require('../config/database');
const { successResponse, paginatedResponse, paginate } = require('../utils/apiResponse');

const getStatus = async (req, res) => {
  const status = await escrowService.getEscrowStatus(req.params.taskId);
  successResponse(res, status, 'Escrow status fetched');
};

const getHistory = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const data = await escrowService.getEscrowHistory(req.user.id, { page, limit });
  const { transactions, total } = data;
  paginatedResponse(res, transactions, paginate(page, limit, total), 'Escrow history fetched');
};

const release = async (req, res) => {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: req.params.submissionId },
    include: { task: true },
  });

  if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
  if (submission.task.posterId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Not your task' });
  }
  if (submission.status !== 'PENDING') {
    return res.status(400).json({ success: false, message: `Submission already ${submission.status.toLowerCase()}` });
  }

  const result = await taskService.reviewSubmission(req.user.id, req.params.submissionId, {
    status: 'APPROVED',
    ...req.body,
  });

  successResponse(res, result, 'Escrow released — payment sent to worker');
};

const refund = async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  if (task.posterId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Not your task' });
  }
  if (task.currentWorkers > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot refund — workers have already applied. Reject submissions first, then cancel.',
    });
  }
  if (task.status === 'CANCELLED' || task.status === 'COMPLETED') {
    return res.status(400).json({ success: false, message: `Task already ${task.status.toLowerCase()}` });
  }

  const tx = await escrowService.refundEscrow(req.params.taskId, 'TASK_CANCELLED');

  await prisma.task.update({
    where: { id: req.params.taskId },
    data: { status: 'CANCELLED' },
  });

  successResponse(res, { txId: tx.id, reference: tx.reference, amount: parseFloat(tx.amount) }, 'Task cancelled and escrow refunded');
};

const dispute = async (req, res) => {
  const { reason, workerEvidence } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Dispute reason is required' });

  const submission = await prisma.taskSubmission.findUnique({
    where: { id: req.params.submissionId },
    include: { task: true },
  });

  if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
  if (submission.workerId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Not your submission' });
  }

  const existingDispute = await prisma.dispute.findUnique({
    where: { submissionId: req.params.submissionId },
  });
  if (existingDispute) {
    return res.status(409).json({ success: false, message: 'Dispute already exists for this submission' });
  }

  const disputeRecord = await prisma.dispute.create({
    data: {
      taskId: submission.taskId,
      submissionId: submission.id,
      workerId: submission.workerId,
      posterId: submission.task.posterId,
      reason,
      workerEvidence,
    },
  });

  await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: { status: 'DISPUTED' },
  });

  await prisma.notification.create({
    data: {
      userId: submission.task.posterId,
      type: 'DISPUTE_OPENED',
      title: '⚖️ Dispute Opened',
      body: `A worker has disputed your rejection on "${submission.task.title}"`,
      data: { taskId: submission.taskId, submissionId: submission.id, disputeId: disputeRecord.id },
    },
  });

  successResponse(res, disputeRecord, 'Dispute submitted — funds remain locked until resolved');
};

const resolve = async (req, res) => {
  const { outcome, resolution } = req.body;
  if (!['WORKER_WON', 'POSTER_WON', 'SPLIT'].includes(outcome)) {
    return res.status(400).json({ success: false, message: 'Invalid outcome. Must be WORKER_WON, POSTER_WON, or SPLIT' });
  }

  const disputeRecord = await prisma.dispute.findUnique({
    where: { id: req.params.disputeId },
    include: { submission: { include: { task: true } } },
  });
  if (!disputeRecord) return res.status(404).json({ success: false, message: 'Dispute not found' });

  const task = disputeRecord.submission.task;
  const amount = parseFloat(task.reward);

  return prisma.$transaction(async (db) => {
    let workerPayout = 0;
    let posterRefund = 0;

    if (outcome === 'WORKER_WON') {
      workerPayout = amount;
    } else if (outcome === 'POSTER_WON') {
      posterRefund = amount;
    } else if (outcome === 'SPLIT') {
      workerPayout = amount / 2;
      posterRefund = amount / 2;
    }

    if (workerPayout > 0) {
      const workerWallet = await db.wallet.findUnique({
        where: { userId_currency: { userId: disputeRecord.workerId, currency: task.currency } },
      });
      if (workerWallet) {
        await db.wallet.update({
          where: { id: workerWallet.id },
          data: { balance: { increment: workerPayout } },
        });
        await db.transaction.create({
          data: {
            userId: disputeRecord.workerId,
            walletId: workerWallet.id,
            type: 'TASK_PAYMENT',
            status: 'COMPLETED',
            amount: workerPayout,
            currency: task.currency,
            reference: `OGA-DISPUTE-${require('uuid').v4().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
            balanceBefore: parseFloat(workerWallet.balance),
            balanceAfter: parseFloat(workerWallet.balance) + workerPayout,
            taskId: task.id,
            completedAt: new Date(),
            description: 'Dispute resolution — worker payout',
          },
        });
      }
    }

    if (posterRefund > 0) {
      const posterWallet = await db.wallet.findUnique({
        where: { userId_currency: { userId: disputeRecord.posterId, currency: task.currency } },
      });
      if (posterWallet) {
        await db.wallet.update({
          where: { id: posterWallet.id },
          data: {
            lockedBalance: { decrement: posterRefund },
            balance: { increment: posterRefund },
          },
        });
      }
    } else {
      const posterWallet = await db.wallet.findUnique({
        where: { userId_currency: { userId: disputeRecord.posterId, currency: task.currency } },
      });
      if (posterWallet) {
        await db.wallet.update({
          where: { id: posterWallet.id },
          data: { lockedBalance: { decrement: amount } },
        });
      }
    }

    const updated = await db.dispute.update({
      where: { id: disputeRecord.id },
      data: {
        outcome,
        resolution,
        resolvedById: req.user.id,
        resolvedAt: new Date(),
      },
    });

    await db.taskSubmission.update({
      where: { id: disputeRecord.submissionId },
      data: {
        status: outcome === 'WORKER_WON' ? 'APPROVED' : 'REJECTED',
        paidAt: workerPayout > 0 ? new Date() : undefined,
      },
    });

    successResponse(res, updated, 'Dispute resolved');
  });
};

module.exports = {
  getStatus,
  getHistory,
  release,
  refund,
  dispute,
  resolve,
};
