'use strict';

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');

const formatAmount = (amount, currency) => {
  const num = parseFloat(amount);
  if (currency === 'NGN') return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  return `${num.toFixed(6)} ${currency}`;
};

const lockFundsForTask = async (userId, taskId, amount, currency) => {
  let wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, currency, balance: 0, lockedBalance: 0 },
    });
  }

  const available = parseFloat(wallet.balance) - parseFloat(wallet.lockedBalance);
  const platformFee = (amount * PLATFORM_FEE_PERCENT) / 100;
  const totalRequired = amount + platformFee;

  if (available < totalRequired) {
    throw ApiError.badRequest(
      `Insufficient funds. Required: ${formatAmount(totalRequired, currency)} (includes ${PLATFORM_FEE_PERCENT}% platform fee). Available: ${formatAmount(available, currency)}`
    );
  }

  return prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: platformFee },
        lockedBalance: { increment: amount },
      },
    });

    const tx = await db.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: 'TASK_PAYMENT',
        status: 'PENDING',
        amount: totalRequired,
        fee: platformFee,
        currency,
        reference: `OGA-ESCROW-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        balanceBefore: wallet.balance,
        balanceAfter: parseFloat(wallet.balance) - platformFee,
        taskId,
        description: `Escrow for task ${taskId}`,
        metadata: { taskAmount: amount, platformFee },
      },
    });

    return { txId: tx.id, escrowed: totalRequired, fee: platformFee };
  });
};

const releaseEscrow = async (taskId, workerId, amount, currency) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { posterId: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const [workerWallet, posterWallet] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId_currency: { userId: workerId, currency } } }),
    prisma.wallet.findUnique({ where: { userId_currency: { userId: task.posterId, currency } } }),
  ]);
  if (!workerWallet) throw ApiError.notFound('Worker wallet not found');
  if (!posterWallet) throw ApiError.notFound('Poster wallet not found');

  const reference = `OGA-PAY-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  return prisma.$transaction(async (db) => {
    await db.wallet.update({
      where: { id: posterWallet.id },
      data: {
        balance: { decrement: amount },
        lockedBalance: { decrement: amount },
      },
    });

    await db.wallet.update({
      where: { id: workerWallet.id },
      data: { balance: { increment: amount } },
    });

    await db.transaction.create({
      data: {
        userId: workerId,
        walletId: workerWallet.id,
        type: 'TASK_PAYMENT',
        status: 'COMPLETED',
        amount,
        currency,
        reference,
        balanceBefore: workerWallet.balance,
        balanceAfter: parseFloat(workerWallet.balance) + amount,
        taskId,
        completedAt: new Date(),
        description: `Payment for task ${taskId}`,
      },
    });

    await db.workerProfile.update({
      where: { userId: workerId },
      data: { totalEarned: { increment: amount }, tasksCompleted: { increment: 1 } },
    });

    await db.notification.create({
      data: {
        userId: workerId,
        type: 'TASK_PAYMENT_RECEIVED',
        title: 'Payment Received!',
        body: `You received ${formatAmount(amount, currency)} for completing a task.`,
        data: { taskId, amount, currency },
      },
    });

    logger.info(`Escrow released: task ${taskId} -> worker ${workerId} - ${amount} ${currency}`);
  });
};

const refundEscrow = async (taskId, reason = 'TASK_CANCELLED') => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, posterId: true, escrowTxId: true, reward: true, currency: true, maxWorkers: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const escrowTx = await prisma.transaction.findUnique({ where: { id: task.escrowTxId } });
  if (!escrowTx) throw ApiError.notFound('Escrow transaction not found');

  const totalLocked = parseFloat(task.reward) * task.maxWorkers;

  return prisma.$transaction(async (db) => {
    const posterWallet = await db.wallet.findUnique({
      where: { userId_currency: { userId: task.posterId, currency: task.currency } },
    });
    if (!posterWallet) throw ApiError.notFound('Poster wallet not found');

    await db.wallet.update({
      where: { id: posterWallet.id },
      data: {
        lockedBalance: { decrement: totalLocked },
        balance: { increment: totalLocked },
      },
    });

    const refundTx = await db.transaction.create({
      data: {
        userId: task.posterId,
        walletId: posterWallet.id,
        type: 'TASK_REFUND',
        status: 'COMPLETED',
        amount: totalLocked,
        currency: task.currency,
        reference: `OGA-REFUND-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        balanceBefore: parseFloat(posterWallet.balance) + totalLocked,
        balanceAfter: parseFloat(posterWallet.balance) + totalLocked,
        taskId,
        description: `Escrow refund — ${reason.replace(/_/g, ' ')}`,
        completedAt: new Date(),
      },
    });

    await db.task.update({
      where: { id: taskId },
      data: { escrowed: false },
    });

    await db.notification.create({
      data: {
        userId: task.posterId,
        type: 'ESCROW_REFUNDED',
        title: '💰 Escrow Refunded',
        body: `${formatAmount(totalLocked, task.currency)} has been returned to your wallet.`,
        data: { taskId, amount: totalLocked, currency: task.currency, reason },
      },
    });

    logger.info(`Escrow refunded: task ${taskId} - ${totalLocked} ${task.currency} — ${reason}`);
    return refundTx;
  });
};

const getEscrowStatus = async (taskId) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true, escrowed: true, escrowTxId: true,
      reward: true, currency: true, maxWorkers: true, currentWorkers: true,
      status: true, platformFee: true,
    },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const escrowTx = task.escrowTxId
    ? await prisma.transaction.findUnique({ where: { id: task.escrowTxId } })
    : null;

  const totalPool = parseFloat(task.reward) * task.maxWorkers;
  const totalPaid = parseFloat(task.reward) * task.currentWorkers;
  const remaining = task.escrowed ? totalPool - totalPaid : 0;

  return {
    taskId: task.id,
    isEscrowed: task.escrowed,
    currency: task.currency,
    rewardPerSlot: parseFloat(task.reward),
    totalPool,
    totalPaid,
    remainingLocked: remaining,
    platformFee: parseFloat(task.platformFee || 0),
    status: task.status,
    slotsFilled: task.currentWorkers,
    slotsTotal: task.maxWorkers,
    transaction: escrowTx ? {
      id: escrowTx.id,
      status: escrowTx.status,
      reference: escrowTx.reference,
      createdAt: escrowTx.createdAt,
    } : null,
  };
};

const getEscrowHistory = async (userId, { page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const where = {
    userId,
    type: { in: ['TASK_PAYMENT', 'TASK_REFUND', 'PLATFORM_FEE'] },
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      status: tx.status,
      amount: parseFloat(tx.amount),
      fee: parseFloat(tx.fee),
      currency: tx.currency,
      reference: tx.reference,
      description: tx.description,
      taskId: tx.taskId,
      taskTitle: tx.task?.title,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
    })),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

module.exports = {
  lockFundsForTask,
  releaseEscrow,
  refundEscrow,
  getEscrowStatus,
  getEscrowHistory,
};
