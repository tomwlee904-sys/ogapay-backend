'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

const router = express.Router();

// Social links and chat live in the database (they used to be kept in memory
// and vanished on every deploy).
const httpsUrl = (v) => typeof v === 'string' && /^https:\/\/[^\s"'()<>]+$/i.test(v.trim()) && v.length <= 2048;
const hexColor = (v) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : undefined);
const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
// twitter / telegram / discord from a request body (only the keys that were sent)
function socialFields(body) {
  const out = {};
  for (const k of ['twitter', 'telegram', 'discord']) {
    if (body[k] !== undefined) out[k] = clip(String(body[k] ?? ''), 200) || null;
  }
  return out;
}
const CHAT_MAX = 1000;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// ─── Featured Communities (with real stats) ────────────────────
// Map community-style category names to TaskCategory enum values
const TASK_CATEGORY_MAP = {
  'social': 'SOCIAL_MEDIA',
  'crypto': 'OTHER',
  'business': 'OTHER',
  'content': 'CONTENT_WRITING',
  'design': 'DESIGN',
  'marketing': 'OTHER',
  'technology': 'WEB_RESEARCH',
  'gaming': 'OTHER',
  'education': 'OTHER',
  'other': 'OTHER',
};

router.get('/featured', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 3, 10);
  const communities = await prisma.community.findMany({
    where: {},
    include: { _count: { select: { members: true } } },
    orderBy: { members: { _count: 'desc' } },
    take: limit,
  });

  const enriched = await Promise.all(communities.map(async (c) => {
    const taskCat = TASK_CATEGORY_MAP[c.category?.toLowerCase()] || 'OTHER';
    try {
      const [jobCount, approvedSubs] = await Promise.all([
        prisma.task.count({
          where: { category: taskCat, status: { in: ['OPEN', 'COMPLETED'] } },
        }),
        prisma.taskSubmission.findMany({
          where: { status: 'APPROVED', task: { category: taskCat } },
          select: { task: { select: { reward: true } } },
        }),
      ]);
      const distributed = approvedSubs.reduce((sum, s) => sum + Number(s.task.reward), 0);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        coverImage: c.coverImage,
        coverColor: c.coverColor,
        coverTextColor: c.coverTextColor,
        iconUrl: c.iconUrl,
        accentColor: c.accentColor,
        category: c.category,
        isActive: c.isActive,
        memberCount: c._count.members,
        jobCount,
        distributed,
        createdAt: c.createdAt,
      };
    } catch {
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        coverImage: c.coverImage,
        coverColor: c.coverColor,
        coverTextColor: c.coverTextColor,
        iconUrl: c.iconUrl,
        accentColor: c.accentColor,
        category: c.category,
        isActive: c.isActive,
        memberCount: c._count.members,
        jobCount: 0,
        distributed: 0,
        createdAt: c.createdAt,
      };
    }
  }));

  successResponse(res, enriched);
});

// ─── List Communities ──────────────────────────────────────────
const CATEGORY_BADGE_MAP = {
  'technology': { badge: 'Technology', accent: '#7C3AED' },
  'crypto': { badge: 'Crypto', accent: '#1F8CFF' },
  'social': { badge: 'Social', accent: '#033CE3' },
  'design': { badge: 'Design', accent: '#EC4899' },
  'content': { badge: 'Content', accent: '#22C55E' },
  'marketing': { badge: 'Marketing', accent: '#F5B301' },
  'business': { badge: 'Business', accent: '#3B82F6' },
  'gaming': { badge: 'Gaming', accent: '#D97706' },
  'education': { badge: 'Education', accent: '#06B6D4' },
  'other': { badge: 'General', accent: '#666' },
};

function getBadgeAndAccent(category) {
  const cat = CATEGORY_BADGE_MAP[category?.toLowerCase()] || { badge: 'General', accent: '#666' };
  return cat;
}

function getInitials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CM';
}

router.get('/', async (req, res) => {
  const { category, search, sort } = req.query;
  const where = { isPublic: true };
  if (category) {
    where.category = { equals: category, mode: 'insensitive' };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const communities = await prisma.community.findMany({
    where,
    include: {
      _count: { select: { members: true } },
    },
    orderBy: sort === 'newest'
      ? { createdAt: 'desc' }
      : { members: { _count: 'desc' } },
  });

  const result = communities.map(c => {
    const { badge, accent } = getBadgeAndAccent(c.category);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      desc: c.description,
      description: c.description,
      iconUrl: c.iconUrl,
      coverImage: c.coverImage,
      accentColor: c.accentColor || accent,
      accent: c.accentColor || accent,
      category: c.category,
      badge,
      initials: getInitials(c.name),
      isPublic: c.isPublic,
      isActive: c.isActive,
      trending: c._count.members >= 3,
      members: c._count.members,
      memberCount: c._count.members,
      tasks: 0,
      taskCount: 0,
      rewards: 0,
      createdAt: c.createdAt,
    };
  });

  const totalMembers = result.reduce((s, c) => s + c.members, 0);
  const trending = result.filter(c => c.trending).slice(0, 5);

  successResponse(res, {
    communities: result,
    stats: { total: result.length, members: totalMembers, tasks: 0, rewards: 0 },
    trending,
  });
});

// ─── Get Single Community ─────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: req.params.id },
        { slug: req.params.id },
      ],
    },
    include: {
      owner: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { members: true, requests: true, invites: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        take: 20,
    orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!community) throw ApiError.notFound('Community not found');

  // Check if current user is a member
  let userRole = null;
  let hasRequested = false;
  if (req.user) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (membership) userRole = membership.role;
    
    const pendingRequest = await prisma.communityRequest.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (pendingRequest) hasRequested = true;
  }

  // Count tasks matching this community's category
  const taskCat = TASK_CATEGORY_MAP[community.category?.toLowerCase()] || 'OTHER';
  const openJobs = await prisma.task.count({
    where: { category: taskCat, status: 'OPEN' },
  });
  const completedJobs = await prisma.task.count({
    where: { category: taskCat, status: 'COMPLETED' },
  });

  // Sum earnings from completed submissions for tasks in this category
  const completedSubmissions = await prisma.taskSubmission.findMany({
    where: {
      status: 'APPROVED',
      task: { category: taskCat },
    },
    select: { task: { select: { reward: true } } },
  });
  const totalDistributed = completedSubmissions.reduce((sum, s) => sum + Number(s.task.reward), 0);

  successResponse(res, {
    id: community.id,
    slug: community.slug,
    name: community.name,
    description: community.description,
    iconUrl: community.iconUrl,
    coverImage: community.coverImage,
    coverColor: community.coverColor,
    coverTextColor: community.coverTextColor,
    accentColor: community.accentColor,
    category: community.category,
    isActive: community.isActive,
    isPublic: community.isPublic,
    owner: community.owner,
    twitter: community.twitter || '',
    telegram: community.telegram || '',
    discord: community.discord || '',
    memberCount: community._count.members,
    inviteCount: community._count.invites,
    requestCount: community._count.requests,
    // A private community's member list is for its members
    recentMembers: community.isPublic || userRole ? community.members : [],
    userRole,
    hasRequested,
    challengeCount: openJobs + completedJobs,
    openJobCount: openJobs,
    completedJobCount: completedJobs,
    totalDistributed,
    createdAt: community.createdAt,
  });
});

// ─── Create Community ─────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { name, description, category, accentColor, coverColor, coverTextColor, isActive, isPublic, twitter, telegram, discord } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) throw ApiError.badRequest('Community name must be at least 2 characters');
  if (name.trim().length > 60) throw ApiError.badRequest('Community name must be 60 characters or fewer');
  if (description && String(description).length > 1000) throw ApiError.badRequest('Description must be 1,000 characters or fewer');

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(3).toString('hex');

  const community = await prisma.community.create({
    data: {
      name: name.trim(),
      slug,
      description: clip(description, 1000),
      category: clip(category, 40),
      accentColor: hexColor(accentColor) || '#7C3AED',
      coverColor: hexColor(coverColor),
      coverTextColor: hexColor(coverTextColor),
      isActive: isActive !== undefined ? isActive !== false : true,
      isPublic: isPublic !== false,
      ownerId: req.user.id,
      ...socialFields({ twitter, telegram, discord }),
    },
  });

  // Auto-join the creator as OWNER
  await prisma.communityMember.create({
    data: {
      communityId: community.id,
      userId: req.user.id,
      role: 'OWNER',
    },
  });

  createdResponse(res, community, 'Community created');
});


// ─── Cover Image Upload (JSON body) ──────────────────────────────
router.post('/:id/cover', authenticate, async (req, res, next) => {
  // Only handle if JSON body with coverUrl is sent
  if (!req.body || !req.body.coverUrl) return next();
  try {
    if (!httpsUrl(req.body.coverUrl)) throw ApiError.badRequest('Cover image must be an https link');
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) throw ApiError.notFound('Community not found');
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ApiError.forbidden('Only owners and admins can update the cover image');
    }
    await prisma.community.update({
      where: { id: community.id },
      data: { coverImage: req.body.coverUrl },
    });
    successResponse(res, { coverImage: req.body.coverUrl }, 'Cover image updated');
  } catch (e) { next(e); }
});

// ─── Cover Image Upload (Multipart) ──────────────────────────────
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const { supabaseAdmin } = require('../config/supabase');

router.post('/:id/cover', authenticate, upload.single('cover'), async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw ApiError.forbidden('Only owners and admins can upload a cover image');
  }
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  if (!IMAGE_TYPES.includes(req.file.mimetype)) throw ApiError.badRequest('Upload a PNG, JPG, WebP or GIF image');

  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `communities/${community.id}/${Date.now()}-${safeName}`;
  const bucket = process.env.SUPABASE_STORE_BUCKET || 'ogapay-uploads';
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) throw ApiError.internal('Failed to upload cover image');

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(key);

  await prisma.community.update({
    where: { id: community.id },
    data: { coverImage: data.publicUrl },
  });

  successResponse(res, { coverImage: data.publicUrl }, 'Cover image uploaded');
});

// ─── Avatar Image Upload ──────────────────────────────
router.post('/:id/avatar', authenticate, async (req, res, next) => {
  if (!req.body || !req.body.avatarUrl) return next();
  try {
    if (!httpsUrl(req.body.avatarUrl)) throw ApiError.badRequest('Avatar must be an https link');
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community) throw ApiError.notFound('Community not found');
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ApiError.forbidden('Only owners and admins can update the avatar');
    }
    await prisma.community.update({
      where: { id: community.id },
      data: { iconUrl: req.body.avatarUrl },
    });
    successResponse(res, { iconUrl: req.body.avatarUrl }, 'Avatar image updated');
  } catch (e) { next(e); }
});

// ─── Admin Update Community (bypasses membership check) ──────
router.patch('/:id/admin', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || user.role !== 'ADMIN') throw ApiError.forbidden('Admin access required');

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const { name, description, category, accentColor, coverColor, coverTextColor, isActive, isPublic } = req.body;

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() }),
      ...(category && { category }),
      ...(accentColor && { accentColor }),
      ...(coverColor && { coverColor }),
      ...(coverTextColor && { coverTextColor }),
      ...(isActive !== undefined && { isActive }),
      ...(isPublic !== undefined && { isPublic }),
    },
  });

  successResponse(res, updated, 'Community updated by admin');
});

// ─── Update Community ─────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  // Admins can bypass membership check
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || user.role !== 'ADMIN') {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw ApiError.forbidden('Only owners and admins can update the community');
    }
  }

  const { name, description, category, accentColor, coverColor, coverTextColor, isActive, isPublic } = req.body;
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60)) {
    throw ApiError.badRequest('Community name must be 2 to 60 characters');
  }
  if (description && String(description).length > 1000) throw ApiError.badRequest('Description must be 1,000 characters or fewer');

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: clip(String(description ?? ''), 1000) }),
      ...(category && { category: clip(category, 40) }),
      ...(hexColor(accentColor) && { accentColor }),
      ...(hexColor(coverColor) && { coverColor }),
      ...(hexColor(coverTextColor) && { coverTextColor }),
      ...(isActive !== undefined && { isActive: isActive !== false }),
      ...(isPublic !== undefined && { isPublic: isPublic !== false }),
      ...socialFields(req.body),
    },
  });

  successResponse(res, updated, 'Community updated');
});

// ─── Delete Community ─────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');
  if (community.ownerId !== req.user.id) throw ApiError.forbidden('Only the owner can delete the community');

  await prisma.community.delete({ where: { id: community.id } });
  successResponse(res, null, 'Community deleted');
});

// ─── List Members ─────────────────────────────────────────────
router.get('/:id/members', async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const members = await prisma.communityMember.findMany({
    where: { communityId: community.id },
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });

  successResponse(res, members.map(m => ({
    id: m.id,
    userId: m.user.id,
    username: m.user.username,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    joinedAt: m.createdAt,
  })));
});

// ─── Update Member Role ───────────────────────────────────────
router.patch('/:id/members/:memberId', authenticate, async (req, res) => {
  const { role } = req.body;
  if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
    throw ApiError.badRequest('Invalid role. Must be ADMIN, MODERATOR, or MEMBER');
  }

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const requester = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
    throw ApiError.forbidden('Only owners and admins can change roles');
  }
  if (requester.role !== 'OWNER' && role === 'ADMIN') {
    throw ApiError.forbidden('Only the owner can assign admin role');
  }

  // The member must belong to this community (not one the requester doesn't lead)
  const target = await prisma.communityMember.findUnique({ where: { id: req.params.memberId } });
  if (!target || target.communityId !== community.id) throw ApiError.notFound('Member not found');
  if (target.role === 'OWNER') throw ApiError.forbidden("The owner's role can't be changed");
  if (target.role === 'ADMIN' && requester.role !== 'OWNER') throw ApiError.forbidden('Only the owner can change an admin');

  const updated = await prisma.communityMember.update({
    where: { id: target.id },
    data: { role },
  });

  successResponse(res, updated, 'Member role updated');
});

// ─── Remove Member ────────────────────────────────────────────
router.delete('/:id/members/:memberId', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const requester = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
    throw ApiError.forbidden('Only owners and admins can remove members');
  }

  const target = await prisma.communityMember.findUnique({ where: { id: req.params.memberId } });
  if (!target || target.communityId !== community.id) throw ApiError.notFound('Member not found');
  if (target.role === 'OWNER') throw ApiError.forbidden('Cannot remove the owner');
  if (target.role === 'ADMIN' && requester.role !== 'OWNER') throw ApiError.forbidden('Only the owner can remove an admin');

  await prisma.communityMember.delete({ where: { id: target.id } });
  successResponse(res, null, 'Member removed');
});

// ─── Join Community ───────────────────────────────────────────
router.post('/:id/join', authenticate, async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  // Check if already a member
  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (existing) throw ApiError.conflict('Already a member');

  // If public, join directly. If private, create a request.
  if (community.isPublic) {
    const member = await prisma.communityMember.create({
      data: { communityId: community.id, userId: req.user.id, role: 'MEMBER' },
    });
    createdResponse(res, { communityId: community.id, role: member.role }, 'Joined community');
  } else {
    // Check for existing request
    const existingRequest = await prisma.communityRequest.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
    });
    if (existingRequest) throw ApiError.conflict('Join request already exists');

    const request = await prisma.communityRequest.create({
      data: { communityId: community.id, userId: req.user.id },
    });

    // Notify community owner about join request
    try {
      await prisma.notification.create({
        data: {
          userId: community.ownerId,
          type: 'JOIN_REQUEST',
          title: 'New join request',
          body: `Someone wants to join "${community.name}"`,
          data: { communityId: community.id, requestId: request.id, requesterId: req.user.id },
        },
      });
    } catch (err) {
      logger.warn(`Failed to notify owner about join request: ${err.message}`);
    }

    createdResponse(res, { requestId: request.id }, 'Join request submitted');
  }
});


// ─── Request to Join (with message) ────────────────────────────
router.post('/:id/request', authenticate, async (req, res) => {
  const { message, attachments } = req.body;
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (existing) throw ApiError.conflict('Already a member');

  const existingRequest = await prisma.communityRequest.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (existingRequest) throw ApiError.conflict('Join request already exists');

  const request = await prisma.communityRequest.create({
    data: {
      communityId: community.id,
      userId: req.user.id,
      message: message?.trim() || '',
      attachments: attachments || [],
    },
  });

  // Notify community owner about join request
  try {
    await prisma.notification.create({
      data: {
        userId: community.ownerId,
        type: 'JOIN_REQUEST',
        title: 'New join request',
        body: `Someone wants to join "${community.name}"`,
        data: { communityId: community.id, requestId: request.id, requesterId: req.user.id },
      },
    });
  } catch (err) {
    logger.warn(`Failed to notify owner about join request: ${err.message}`);
  }

  createdResponse(res, { requestId: request.id }, 'Join request submitted');
});

// ─── Leave Community ──────────────────────────────────────────
router.post('/:id/leave', authenticate, async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership) throw ApiError.notFound('Not a member');
  if (membership.role === 'OWNER') throw ApiError.forbidden('Owner cannot leave. Transfer ownership first.');

  await prisma.communityMember.delete({ where: { id: membership.id } });
  successResponse(res, null, 'Left community');
});

// ─── User's Communities ───────────────────────────────────────
router.get('/mine/list', authenticate, async (req, res) => {
  const memberships = await prisma.communityMember.findMany({
    where: { userId: req.user.id },
    include: {
      community: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  successResponse(res, memberships.map(m => ({
    communityId: m.communityId,
    slug: m.community.slug,
    name: m.community.name,
    description: m.community.description,
    accentColor: m.community.accentColor,
    iconUrl: m.community.iconUrl,
    isPublic: m.community.isPublic,
    role: m.role,
    memberCount: m.community._count.members,
    joinedAt: m.createdAt,
  })));
});

// ─── My pending invites ───────────────────────────────────────
router.get('/invites/mine', authenticate, async (req, res) => {
  const invites = await prisma.communityInvite.findMany({
    where: { inviteeId: req.user.id, status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, message: true, createdAt: true, expiresAt: true,
      community: { select: { id: true, name: true, slug: true, coverImage: true, accentColor: true } },
      inviter: { select: { username: true, avatarUrl: true } },
    },
  });
  successResponse(res, invites);
});

// ─── Invite User ──────────────────────────────────────────────
router.post('/:id/invite', authenticate, async (req, res) => {
  const { email, message, username } = req.body;
  let { inviteeId } = req.body;
  if (!inviteeId && !email && !username) throw ApiError.badRequest('Provide username, inviteeId or email');
  if (message && String(message).length > 300) throw ApiError.badRequest('Message is too long');

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  // Leaders can invite to any community; members can invite to public ones
  const isLeader = membership && ['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role);
  if (!membership || (!isLeader && community.isPublic === false)) {
    throw ApiError.forbidden('Only community leaders can send invites');
  }

  if (username && !inviteeId) {
    const invitee = await prisma.user.findFirst({
      where: { username: { equals: String(username).replace(/^@/, ''), mode: 'insensitive' } },
      select: { id: true, isBanned: true },
    });
    if (!invitee || invitee.isBanned) throw ApiError.notFound('User not found');
    inviteeId = invitee.id;
  }
  if (inviteeId === req.user.id) throw ApiError.badRequest('You are already in this community');

  // Check if invitee is already a member
  if (inviteeId) {
    const alreadyMember = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: inviteeId } },
    });
    if (alreadyMember) throw ApiError.conflict('User is already a member');

    // One open invite per person per community (no notification spam)
    const pending = await prisma.communityInvite.findFirst({
      where: { communityId: community.id, inviteeId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    if (pending) return successResponse(res, { id: pending.id, expiresAt: pending.expiresAt, alreadyInvited: true }, 'Already invited');
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.communityInvite.create({
    data: {
      communityId: community.id,
      inviterId: req.user.id,
      inviteeId: inviteeId || null,
      email: email || null,
      token,
      message: message || null,
      expiresAt,
    },
  });

  if (inviteeId) {
    const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });
    await prisma.notification.create({
      data: {
        userId: inviteeId,
        type: 'COMMUNITY_INVITE',
        title: `Invitation to ${community.name}`,
        body: `@${inviter?.username || 'someone'} invited you to join ${community.name}.`,
        data: { communityId: community.id, inviteId: invite.id },
      },
    }).catch(() => {});
  }

  createdResponse(res, {
    id: invite.id,
    token: invite.token,
    expiresAt: invite.expiresAt,
  }, 'Invite sent');
});

// ─── List Invites (for community) ─────────────────────────────
router.get('/:id/invites', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw ApiError.forbidden('Only owners and admins can view invites');
  }

  const invites = await prisma.communityInvite.findMany({
    where: { communityId: community.id },
    include: {
      inviter: { select: { id: true, username: true } },
      invitee: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  successResponse(res, invites);
});

// ─── Accept/Decline Invite ────────────────────────────────────
router.patch('/invites/:inviteId', authenticate, async (req, res) => {
  const { action } = req.body; // 'accept' | 'decline'
  if (!['accept', 'decline'].includes(action)) throw ApiError.badRequest('Action must be accept or decline');

  const invite = await prisma.communityInvite.findUnique({ where: { id: req.params.inviteId } });
  if (!invite) throw ApiError.notFound('Invite not found');
  if (invite.inviteeId !== req.user.id) throw ApiError.forbidden('This invite is not for you');
  if (invite.status !== 'PENDING') throw ApiError.conflict('Invite already responded');
  if (invite.expiresAt < new Date()) throw ApiError.conflict('Invite has expired');

  const { count } = await prisma.communityInvite.updateMany({
    where: { id: invite.id, status: 'PENDING' },
    data: { status: action === 'accept' ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  });
  if (!count) throw ApiError.conflict('Invite already responded');

  if (action === 'accept') {
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: invite.communityId, userId: req.user.id } },
      update: {},
      create: { communityId: invite.communityId, userId: req.user.id, role: 'MEMBER' },
    });
    successResponse(res, { communityId: invite.communityId }, 'Invite accepted');
  } else {
    successResponse(res, null, 'Invite declined');
  }
});

// ─── Join Requests (for community) ────────────────────────────
router.get('/:id/requests', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
    throw ApiError.forbidden('Only community leaders can view requests');
  }

  const requests = await prisma.communityRequest.findMany({
    where: { communityId: community.id, status: 'PENDING' },
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  successResponse(res, requests);
});

// ─── Approve/Reject Join Request ──────────────────────────────
router.patch('/:id/requests/:requestId', authenticate, async (req, res) => {
  const { action } = req.body;
  if (!['accept', 'decline'].includes(action)) throw ApiError.badRequest('Action must be accept or decline');

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
    throw ApiError.forbidden('Only community leaders can handle requests');
  }

  const request = await prisma.communityRequest.findUnique({ where: { id: req.params.requestId } });
  // Leaders can only answer requests to their own community
  if (!request || request.communityId !== community.id) throw ApiError.notFound('Request not found');
  if (request.status !== 'PENDING') throw ApiError.conflict('Request already handled');

  const { count } = await prisma.communityRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: { status: action === 'accept' ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date(), responderId: req.user.id },
  });
  if (!count) throw ApiError.conflict('Request already handled');

  if (action === 'accept') {
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: request.userId } },
      update: {},
      create: { communityId: community.id, userId: request.userId, role: 'MEMBER' },
    });

    // Notify requester that their request was accepted
    try {
      await prisma.notification.create({
        data: {
          userId: request.userId,
          type: 'JOIN_REQUEST_APPROVED',
          title: 'Join request approved',
          body: `Your request to join "${community.name}" was accepted!`,
          data: { communityId: community.id },
        },
      });
    } catch (err) {
      logger.warn(`Failed to notify requester about approved join request: ${err.message}`);
    }

    successResponse(res, { userId: request.userId }, 'Request accepted');
  } else {
    successResponse(res, null, 'Request declined');
  }
});

// ─── Leaderboard ──────────────────────────────────────────────
// GET  /:id/leaderboard?page=1&limit=20
router.get('/:id/leaderboard', async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Rank every member first, then take the page (sorting one page alone gave wrong ranks)
  const members = await prisma.communityMember.findMany({
    where: { communityId: community.id, user: { isBanned: false } },
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true, lastName: true, avatarUrl: true, preferences: true,
          workerProfile: { select: { level: true, tasksCompleted: true, totalEarned: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  });
  const total = members.length;

  const sorted = members
    .map(m => ({
      id: m.user.id,
      username: m.user.username,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      level: m.user.workerProfile?.level || 'BEGINNER',
      tasksCompleted: m.user.workerProfile?.tasksCompleted || 0,
      // Earnings only for people who chose to show them
      totalEarned: m.user.preferences?.showEarnings === true ? Number(m.user.workerProfile?.totalEarned || 0) : null,
      joinedAt: m.createdAt,
    }))
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

  const ranked = sorted.slice(skip, skip + limit).map((m, i) => ({ rank: skip + i + 1, ...m }));

  successResponse(res, {
    members: ranked,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  });
});

// ─── Open Jobs ────────────────────────────────────────────────
// GET  /:id/jobs/open?page=1&limit=20
router.get('/:id/jobs/open', async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const taskCat = TASK_CATEGORY_MAP[community.category?.toLowerCase()] || 'OTHER';
  const where = { category: taskCat, status: 'OPEN', hiredWorkerId: null };

  const [jobs, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true, title: true, description: true, reward: true, currency: true,
        category: true, createdAt: true, deadline: true,
        poster: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  successResponse(res, {
    jobs: jobs.map(j => ({
      id: j.id,
      title: j.title,
      reward: Number(j.reward),
      currency: j.currency,
      category: j.category,
      poster: j.poster,
      submissionCount: j._count.submissions,
      createdAt: j.createdAt,
      deadline: j.deadline,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ─── Completed Jobs ───────────────────────────────────────────
// GET  /:id/jobs/completed?page=1&limit=20
router.get('/:id/jobs/completed', async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const taskCat = TASK_CATEGORY_MAP[community.category?.toLowerCase()] || 'OTHER';
  const where = { category: taskCat, status: 'COMPLETED', hiredWorkerId: null };

  const [jobs, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true, title: true, reward: true, currency: true,
        category: true, updatedAt: true,
        poster: { select: { id: true, username: true } },
        submissions: {
          where: { status: 'APPROVED' },
          select: { worker: { select: { id: true, username: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  successResponse(res, {
    jobs: jobs.map(j => ({
      id: j.id,
      title: j.title,
      reward: Number(j.reward),
      currency: j.currency,
      rewardPaid: Number(j.reward),
      poster: j.poster,
      completedAt: j.updatedAt,
      workers: j.submissions.map(s => s.worker),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ─── Chat Messages ────────────────────────────────────────────
// GET  /:id/chat — members only
router.get('/:id/chat', authenticate, async (req, res) => {
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership) throw ApiError.forbidden('Only community members can view chat');

  const rows = await prisma.communityChatMessage.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
  });
  successResponse(res, rows.reverse().map((m) => ({ id: m.id, communityId: m.communityId, sender: m.sender, text: m.text, createdAt: m.createdAt })));
});

// POST /:id/chat — members only
router.post('/:id/chat', authenticate, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) throw ApiError.badRequest('Message text is required');
  if (text.length > CHAT_MAX) throw ApiError.badRequest(`Messages can be up to ${CHAT_MAX} characters`);

  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership) throw ApiError.forbidden('Only community members can send messages');

  // A little flood control: 20 messages a minute per person
  const recent = await prisma.communityChatMessage.count({
    where: { communityId: community.id, senderId: req.user.id, createdAt: { gte: new Date(Date.now() - 60000) } },
  });
  if (recent >= 20) throw ApiError.tooManyRequests('Slow down a little before sending more messages');

  const m = await prisma.communityChatMessage.create({
    data: { communityId: community.id, senderId: req.user.id, text },
    include: { sender: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
  });

  createdResponse(res, { id: m.id, communityId: m.communityId, sender: m.sender, text: m.text, createdAt: m.createdAt }, 'Message sent');
});

// ─── Social Links ─────────────────────────────────────────────
// PATCH /:id/socials — owner/admins only
router.patch('/:id/socials', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw ApiError.forbidden('Only owners and admins can update social links');
  }

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: socialFields(req.body),
    select: { twitter: true, telegram: true, discord: true },
  });

  successResponse(res, updated, 'Social links updated');
});

module.exports = router;
