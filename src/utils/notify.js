'use strict';

const { prisma } = require('../config/database');

async function createNotification({ userId, title, body, type, data }) {
  return prisma.notification.create({
    data: {
      userId,
      type: type || 'INFO',
      title,
      body: body || title,
      data: data || undefined,
    },
  });
}

module.exports = { createNotification };