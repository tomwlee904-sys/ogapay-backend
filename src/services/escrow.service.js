'use strict';
const vaultService = require('./vault.service');

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');
const { ApiError } = require('../utils/apiResponse');
const { spendAndHold, round8 } = require('../utils/ledger');
const { fetchPrices, FALLBACK_PRICES } = require('./price.service');
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');

const formatAmount = (amount, currency) => {
  const num = parseFloat(amount);
  if (currency === 'NGN') return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  return `${num.toFixed(6)} ${currency}`;
};

// Charge the platform fee and hold the worker rewards in escrow, in one guarded
// step. Pass `db` to run inside the caller's transaction (task creation), so a
// failed insert can't leave money locked with no task attached.
const lockFundsForTask = async (userId, taskId, amount, currency, db) => {
  const run = async (client) => {
    const wallet = await client.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      update: {},
      create: { userId, currency, balance: 0, lockedBalance: 0 },
    });

    const platformFee = round8((amount * PLATFORM_FEE_PERCENT) / 100);
    const totalRequired = round8(amount + platformFee);

    if (!(await spendAndHold(client, wallet.id, platformFee, amount))) {
      const available = Math.max(0, parseFloat(wallet.balance) - parseFloat(wallet.lockedBalance));
      throw ApiError.badRequest(`Insufficient balance. Need ${formatAmount(totalRequired, currency)}, available ${formatAmount(available, currency)}`);
    }

    const tx = await client.transaction.create({
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
  };

  return db ? run(db) : prisma.$transaction(run);
};

// Add a task's platform fee to the vault pool, in naira. Call once the task is
// committed. Never throws.
const logTaskFee = async (taskId, fee, currency) => {
  try {
    let ngn = Number(fee);
    if (currency !== 'NGN') {
      const key = String(currency).toLowerCase();
      const prices = await fetchPrices().catch(() => null);
      const rate = prices?.[key]?.ngn || FALLBACK_PRICES[key]?.ngn;
      if (!rate) {
        logger.warn(`Vault fee for task ${taskId} not logged: no NGN rate for ${currency}`);
        return;
      }
      ngn = Number(fee) * rate;
    }
    await vaultService.logRevenue({
      source: 'task_fee',
      sourceId: taskId,
      amountNgp: round8(ngn),
      description: `Platform fee for task ${taskId} (${fee} ${currency})`,
    });
  } catch (err) {
    logger.error(`Vault revenue log failed for task ${taskId}: ${err.message}`);
  }
};

// Pay a worker from the poster's escrow: the poster's balance and hold both drop
// by the amount and the worker's balance rises by it.
const releaseEscrow = async (taskId, workerId, amount, currency, submissionId, tx) => {
  const client = tx || prisma;

  const task = await client.task.findUnique({
    where: { id: taskId },
    select: { id: true, posterId: true, reward: true, maxWorkers: true, escrowed: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const posterWallet = await client.wallet.findUnique({ where: { userId_currency: { userId: task.posterId, currency } } });
  if (!posterWallet) throw ApiError.notFound('Poster wallet not found');

  const reference = `OGA-PAY-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  const execute = async (db) => {
    // Never pay out more than this task still holds in escrow
    const remaining = task.escrowed ? await remainingEscrow(db, task) : 0;
    if (remaining + 1e-8 < Number(amount)) {
      throw ApiError.conflict('This task has no escrow left to pay this worker');
    }

    // Workers who have never held this currency get a wallet instead of a failed approval
    const workerWallet = await db.wallet.upsert({
      where: { userId_currency: { userId: workerId, currency } },
      update: {},
      create: { userId: workerId, currency, balance: 0, lockedBalance: 0 },
    });

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
    // Auto-convert USDC to NGN if worker has the preference enabled
    if (currency === 'USDC') {
      try {
        const walletService = require('./wallet.service');
        await walletService.autoConvertUsdcToNgn(workerId, { db });
      } catch (e) {
        // Non-blocking -- payment already succeeded
        console.error(`Post-escrow auto-convert failed for worker ${workerId}: ${e.message}`);
      }
    }

  };

  if (tx) {
    return execute(tx);
  }
  return prisma.$transaction(execute);
};

// What a task still holds in escrow: the full reward pool minus what workers
// have already been paid from it.
const remainingEscrow = async (db, task) => {
  const paid = await db.transaction.aggregate({
    where: { taskId: task.id, type: 'TASK_PAYMENT', status: 'COMPLETED', userId: { not: task.posterId } },
    _sum: { amount: true },
  });
  const pool = parseFloat(task.reward) * task.maxWorkers;
  return Math.max(0, round8(pool - parseFloat(paid._sum.amount || 0)));
};

// Close a task's escrow exactly once and return the unused part to the poster's
// available balance. Returns the amount released (0 if already closed).
const releaseRemainingEscrow = async (db, taskId) => {
  const { count } = await db.task.updateMany({
    where: { id: taskId, escrowed: true },
    data: { escrowed: false },
  });
  if (count === 0) return 0;

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, posterId: true, reward: true, maxWorkers: true, currency: true },
  });
  const remaining = await remainingEscrow(db, task);
  if (remaining > 0) {
    // The money never left the poster's balance; it only stops being held.
    await db.wallet.update({
      where: { userId_currency: { userId: task.posterId, currency: task.currency } },
      data: { lockedBalance: { decrement: remaining } },
    });
  }
  return remaining;
};

// Once every slot is taken and no submission is still open, finish the task
// and return any unused escrow to the poster.
const completeTaskIfResolved = async (db, taskId) => {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { maxWorkers: true, currentWorkers: true, status: true },
  });
  if (!task || task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  if (task.currentWorkers < task.maxWorkers) return false;

  const open = await db.taskSubmission.count({
    where: { taskId, status: { in: ['PENDING', 'SUBMITTED', 'DISPUTED'] } },
  });
  if (open > 0) return false;

  await db.task.update({ where: { id: taskId }, data: { status: 'COMPLETED' } });
  await releaseRemainingEscrow(db, taskId);
  return true;
};

// Cancel a task nobody has joined yet and return its escrow. The status change
// is the guard, so a second request finds the task already cancelled.
const refundEscrow = async (taskId, reason = 'TASK_CANCELLED') => prisma.$transaction(async (db) => {
  const { count } = await db.task.updateMany({
    where: { id: taskId, currentWorkers: 0, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
    data: { status: 'CANCELLED' },
  });
  if (count === 0) {
    throw ApiError.conflict('This task can no longer be cancelled: it is already closed or workers have joined');
  }

  const task = await db.task.findUnique({ where: { id: taskId }, select: { posterId: true, currency: true } });
  const refunded = await releaseRemainingEscrow(db, taskId);

  const posterWallet = await db.wallet.findUnique({
    where: { userId_currency: { userId: task.posterId, currency: task.currency } },
  });
  if (!posterWallet) throw ApiError.notFound('Poster wallet not found');

  const refundTx = await db.transaction.create({
    data: {
      userId: task.posterId,
      walletId: posterWallet.id,
      type: 'TASK_REFUND',
      status: 'COMPLETED',
      amount: refunded,
      currency: task.currency,
      reference: `OGA-REFUND-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      // Released from escrow: the balance is unchanged, the available part grows
      balanceBefore: posterWallet.balance,
      balanceAfter: posterWallet.balance,
      taskId,
      description: `Escrow refund — ${reason.replace(/_/g, ' ')}`,
      completedAt: new Date(),
    },
  });

  await db.notification.create({
    data: {
      userId: task.posterId,
      type: 'ESCROW_REFUNDED',
      title: '💰 Escrow Refunded',
      body: `${formatAmount(refunded, task.currency)} has been returned to your wallet.`,
      data: { taskId, amount: refunded, currency: task.currency, reason },
    },
  });

  logger.info(`Escrow refunded: task ${taskId} - ${refunded} ${task.currency} — ${reason}`);
  return refundTx;
});

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
  logTaskFee,
  releaseEscrow,
  remainingEscrow,
  releaseRemainingEscrow,
  completeTaskIfResolved,
  refundEscrow,
  getEscrowStatus,
  getEscrowHistory,
};
