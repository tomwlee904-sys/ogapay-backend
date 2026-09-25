'use strict';

const escrowService = require('../services/escrow.service');
const taskService = require('../services/task.service');
const { prisma } = require('../config/database');
const { successResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');

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

  // Marks the task CANCELLED and returns the escrow in one guarded step
  const tx = await escrowService.refundEscrow(req.params.taskId, 'TASK_CANCELLED');

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
  // Only a rejection can be disputed; disputing paid work could get it paid twice
  if (submission.status !== 'REJECTED') {
    return res.status(400).json({ success: false, message: 'Only a rejected submission can be disputed' });
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

  if (disputeRecord.resolvedAt) {
    return res.status(409).json({ success: false, message: 'Dispute already resolved' });
  }

  const task = disputeRecord.submission.task;
  const reward = parseFloat(task.reward);
  const workerPayout = outcome === 'WORKER_WON' ? reward : outcome === 'SPLIT' ? reward / 2 : 0;

  const updated = await prisma.$transaction(async (db) => {
    // Resolve exactly once, even if the request is sent twice
    const { count } = await db.dispute.updateMany({
      where: { id: disputeRecord.id, resolvedAt: null },
      data: { outcome, resolution, resolvedById: req.user.id, resolvedAt: new Date() },
    });
    if (count === 0) throw ApiError.conflict('Dispute already resolved');

    // The worker is paid from this task's escrow, like an approval: the poster's
    // balance and hold drop by the payout. POSTER_WON moves no money, because the
    // rejected slot's reward is still held in escrow for the task.
    if (workerPayout > 0) {
      const fresh = await db.task.findUnique({ where: { id: task.id } });
      const remaining = fresh.escrowed ? await escrowService.remainingEscrow(db, fresh) : 0;
      if (remaining + 1e-8 < workerPayout) {
        throw ApiError.conflict('This task no longer holds enough escrow to pay the worker. Settle it manually.');
      }
      await escrowService.releaseEscrow(task.id, disputeRecord.workerId, workerPayout, task.currency, disputeRecord.submissionId, db);

      // The rejection reopened this worker's slot; take it back so it isn't paid twice
      if (outcome === 'WORKER_WON' && fresh.currentWorkers < fresh.maxWorkers) {
        await db.task.update({ where: { id: task.id }, data: { currentWorkers: { increment: 1 } } });
      }
    }

    await db.taskSubmission.update({
      where: { id: disputeRecord.submissionId },
      data: {
        status: outcome === 'WORKER_WON' ? 'APPROVED' : 'REJECTED',
        paidAt: workerPayout > 0 ? new Date() : undefined,
      },
    });

    await escrowService.completeTaskIfResolved(db, task.id);
    return db.dispute.findUnique({ where: { id: disputeRecord.id } });
  });

  successResponse(res, updated, 'Dispute resolved');
};

module.exports = {
  getStatus,
  getHistory,
  release,
  refund,
  dispute,
  resolve,
};
