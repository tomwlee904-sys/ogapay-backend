'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { ApiError, successResponse, createdResponse } = require('../utils/apiResponse');

const router = express.Router();

// GET /api/v1/messages — List user's conversations
router.get('/', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const userId = req.user.id;

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  });

  const conversations = participants.map(p => {
    const conv = p.conversation;
    const lastMsg = conv.messages[0] || null;
    return {
      id: conv.id,
      participants: conv.participants
        .filter(pp => pp.userId !== userId)
        .map(pp => ({
          id: pp.user.id,
          username: pp.user.username,
          name: pp.user.firstName + ' ' + pp.user.lastName,
          avatarUrl: pp.user.avatarUrl,
        })),
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        createdAt: lastMsg.createdAt,
        senderId: lastMsg.senderId,
      } : null,
      unread: 0, // TODO: implement read receipts
      updatedAt: conv.updatedAt,
    };
  });

  successResponse(res, conversations);
});

// POST /api/v1/messages — Send message (create conversation if needed)
router.post('/', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const userId = req.user.id;
  let { conversationId, recipientId, content } = req.body;

  if (!content || !content.trim()) throw ApiError.badRequest('Message content is required');
  if (!conversationId && !recipientId) throw ApiError.badRequest('Provide conversationId or recipientId');

  let convId = conversationId;

  // If no conversationId, find or create one with recipient
  if (!convId) {
    // Check if conversation already exists between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
    });

    if (existing) {
      convId = existing.id;
    } else {
      // Create new conversation
      const conv = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId },
              { userId: recipientId },
            ],
          },
        },
      });
      convId = conv.id;
    }
  } else {
    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId } },
    });
    if (!participant) throw ApiError.forbidden('Not a participant of this conversation');
  }

  const message = await prisma.message.create({
    data: {
      conversationId: convId,
      senderId: userId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: convId },
    data: { updatedAt: new Date() },
  });

  // Notify the recipient about the new message
  recipientId = recipientId || (await prisma.conversationParticipant.findFirst({
    where: { conversationId: convId, userId: { not: userId } },
    select: { userId: true },
  }))?.userId;
  if (recipientId) {
    try {
      const sender = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'NEW_MESSAGE',
          title: 'New message',
          body: `${sender.firstName || 'Someone'}: ${content.trim().slice(0, 100)}`,
          data: { conversationId: convId, senderId: userId },
        },
      });
    } catch (err) {
      // Non-critical; don't block message send
    }
  }

  createdResponse(res, message, 'Message sent');
});

// GET /api/v1/messages/:conversationId — Get messages for a conversation
router.get('/:conversationId', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const userId = req.user.id;
  const { conversationId } = req.params;

  // Verify user is participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw ApiError.forbidden('Not a participant of this conversation');

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  successResponse(res, messages);
});

// GET /api/v1/messages/users/search — Search users (for starting new chat)
router.get('/users/search', authenticate, async (req, res) => {
  const { prisma } = require('../config/database');
  const { q } = req.query;
  if (!q || q.length < 2) throw ApiError.badRequest('Query must be at least 2 characters');

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
    take: 10,
  });

  successResponse(res, users);
});

module.exports = router;
