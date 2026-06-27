'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');

const router = express.Router();

// GET /api/v1/messages — List user's conversations
router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const conversations = await prisma.conversation.findMany({
    where: { participants: { has: userId } },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const result = await Promise.all(conversations.map(async (conv) => {
    const lastMsg = conv.messages[0];
    const otherIds = conv.participants.filter(p => p !== userId);
    const otherUsers = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const unread = await prisma.message.count({
      where: { conversationId: conv.id, senderId: { not: userId }, readAt: null },
    });
    return {
      id: conv.id,
      participants: otherUsers.map(u => ({
        id: u.id, username: u.username, name: `${u.firstName} ${u.lastName}`.trim() || u.username,
        avatarUrl: u.avatarUrl,
      })),
      lastMessage: lastMsg ? { content: lastMsg.content, createdAt: lastMsg.createdAt, senderId: lastMsg.senderId } : null,
      unread,
      updatedAt: conv.updatedAt,
    };
  }));

  successResponse(res, result);
});

// POST /api/v1/messages — Send a message (creates or finds conversation)
router.post('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { recipientId, conversationId, content } = req.body;
  if (!content) throw ApiError.badRequest('content required');

  let conversation;

  if (conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw ApiError.notFound('Conversation not found');
    if (!conversation.participants.includes(userId)) throw ApiError.forbidden('Not a participant');
  } else {
    if (!recipientId) throw ApiError.badRequest('recipientId required for new conversation');
    if (recipientId === userId) throw ApiError.badRequest('Cannot message yourself');
    conversation = await prisma.conversation.findFirst({
      where: { participants: { hasEvery: [userId, recipientId] } },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { participants: [userId, recipientId] },
      });
    }
  }

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: userId, content },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessage: content, lastSenderId: userId, updatedAt: new Date() },
  });

  createdResponse(res, { message, conversationId: conversation.id }, 'Message sent');
});

// GET /api/v1/messages/:conversationId — Get messages in a conversation
router.get('/:conversationId', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.participants.includes(userId)) throw ApiError.forbidden('Not a participant');

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  // Mark messages as read
  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  successResponse(res, messages);
});

// POST /api/v1/messages/:conversationId/read — Mark conversation as read
router.post('/:conversationId/read', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.participants.includes(userId)) throw ApiError.forbidden('Not a participant');

  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  successResponse(res, null, 'Marked as read');
});

module.exports = router;
