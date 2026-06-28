'use strict';

const { prisma } = require('../config/database');

/**
 * Standardized notification type constants
 */
const NOTIF_TYPES = {
  INFO:                  'INFO',
  DEPOSIT_CONFIRMED:     'DEPOSIT_CONFIRMED',
  WITHDRAWAL_SUCCESS:    'WITHDRAWAL_SUCCESS',
  WITHDRAWAL_FAILED:     'WITHDRAWAL_FAILED',
  REFERRAL_BONUS:        'REFERRAL_BONUS',
  REFERRAL_SIGNUP:       'REFERRAL_SIGNUP',
  SIGNUP_BONUS:          'SIGNUP_BONUS',
  KYC_APPROVED:          'KYC_APPROVED',
  KYC_REJECTED:          'KYC_REJECTED',
  NEW_TASK:              'NEW_TASK',
  TASK_APPLICATION:      'TASK_APPLICATION',
  TASK_SUBMISSION:       'TASK_SUBMISSION',
  SUBMISSION_APPROVED:   'SUBMISSION_APPROVED',
  SUBMISSION_REJECTED:   'SUBMISSION_REJECTED',
  SUBMISSION_REVIEWED:   'SUBMISSION_REVIEWED',
  SLOT_REOPENED:         'SLOT_REOPENED',
  COOLDOWN:              'COOLDOWN',
  COOLDOWN_EXPIRED:      'COOLDOWN_EXPIRED',
  DISPUTE_OPENED:        'DISPUTE_OPENED',
  JOIN_REQUEST:          'JOIN_REQUEST',
  JOIN_REQUEST_APPROVED: 'JOIN_REQUEST_APPROVED',
  NEW_MESSAGE:           'NEW_MESSAGE',
  STORE_PURCHASE:        'STORE_PURCHASE',
  TASK_PAYMENT_RECEIVED: 'TASK_PAYMENT_RECEIVED',
  ESCROW_REFUNDED:       'ESCROW_REFUNDED',
};

/**
 * Create a notification.
 *
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.type - One of NOTIF_TYPES
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {Object} [opts.data]
 * @param {import('@prisma/client').Prisma.TransactionClient} [opts.db] - Optional transaction client
 * @returns {Promise<Object>}
 */
async function createNotification({ userId, type, title, body, data, db }) {
  const client = db || prisma;
  return client.notification.create({
    data: {
      userId,
      type: type || NOTIF_TYPES.INFO,
      title,
      body: body || title,
      data: data || undefined,
    },
  });
}

module.exports = { createNotification, NOTIF_TYPES };
