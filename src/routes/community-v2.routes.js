'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, ApiError } = require('../utils/apiResponse');
const crypto = require('crypto');

const router = express.Router();

// ─── In-memory stores (DB schema can't be migrated live) ─────
const communitySocials = new Map(); // communityId -> { twitter, telegram, discord }
const communityChats = new Map();   // communityId -> [{ id, senderId, sender, text, createdAt }]

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
router.get('/', async (req, res) => {
  const { category, search, sort } = req.query;
  const where = { isPublic: true };
  if (category) where.category = category;
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

  const catBadge = (cat) => {
    const m = { crypto: 'Crypto', social: 'Social', design: 'Design', content: 'Content', marketing: 'Marketing', business: 'Business', technology: 'Technology', gaming: 'Gaming', education: 'Education' };
    return (cat && m[cat.toLowerCase()]) || 'General';
  };

  const mapped = communities.map(c => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    desc: c.description,
    description: c.description,
    iconUrl: c.iconUrl,
    coverImage: c.coverImage,
    accentColor: c.accentColor,
    accent: c.accentColor,
    category: c.category,
    badge: catBadge(c.category || ''),
    isPublic: c.isPublic,
    isActive: c.isActive,
    trending: c.isActive,
    initials: (c.name || '?').split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
    members: c._count.members,
    tasks: 0,
    rewards: 0,
    memberCount: c._count.members,
    taskCount: 0,
    createdAt: c.createdAt,
  }));

  const totalMembers = mapped.reduce((s, c) => s + (c.members || 0), 0);
  const totalTasks = mapped.reduce((s, c) => s + (c.tasks || 0), 0);
  const trending = mapped.filter(c => c.trending);

  // Return frontend-expected format
  res.json({
    success: true,
    data: {
      communities: mapped,
      stats: { total: mapped.length, members: totalMembers, tasks: totalTasks },
      trending,
    },
  });
});

// ─── Get Single Community ─────────────────────────────────────
// ─── My Invites ───────────────────────────────────────────────
router.get('/invites/mine', authenticate, async (req, res) => {
  const invites = await prisma.communityInvite.findMany({
    where: { inviteeId: req.user.id, status: 'PENDING' },
    include: {
      community: { select: { id: true, slug: true, name: true, description: true, accentColor: true, iconUrl: true } },
      inviter: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  successResponse(res, invites);
});

router.get('/:id', async (req, res) => {
  const community = await prisma.community.findFirst({
    where: {
      OR: [
        { id: req.params.id },
        { slug: req.params.id },
      ],
    },
    include: {
      owner: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
      _count: { select: { members: true, requests: true } },
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

  const socials = communitySocials.get(community.id) || {};

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
    twitter: socials.twitter || '',
    telegram: socials.telegram || '',
    discord: socials.discord || '',
    memberCount: community._count.members,
    inviteCount: community._count.invites,
    requestCount: community._count.requests,
    recentMembers: community.members,
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

  if (!name || name.trim().length < 2) throw ApiError.badRequest('Community name must be at least 2 characters');

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(3).toString('hex');

  const community = await prisma.community.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim(),
      category,
      accentColor: accentColor || '#7C3AED',
      coverColor,
      coverTextColor,
      ...(isActive !== undefined && { isActive }),
      isPublic: isPublic !== false,
      ownerId: req.user.id,
    },
  });
  // Store social links in-memory
  if (twitter || telegram || discord) {
    communitySocials.set(community.id, {
      twitter: twitter || '',
      telegram: telegram || '',
      discord: discord || '',
    });
  }

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

// ─── Update Community ─────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw ApiError.forbidden('Only owners and admins can update the community');
  }

  const { name, description, category, accentColor, coverColor, coverTextColor, isActive, isPublic, twitter, telegram, discord } = req.body;

  // Update social links in-memory
  if (twitter !== undefined || telegram !== undefined || discord !== undefined) {
    const existing = communitySocials.get(community.id) || {};
    const updates = {};
    if (twitter !== undefined) updates.twitter = twitter;
    if (telegram !== undefined) updates.telegram = telegram;
    if (discord !== undefined) updates.discord = discord;
    communitySocials.set(community.id, { ...existing, ...updates });
  }

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

  const updated = await prisma.communityMember.update({
    where: { id: req.params.memberId },
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
  if (!target) throw ApiError.notFound('Member not found');
  if (target.role === 'OWNER') throw ApiError.forbidden('Cannot remove the owner');

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
    orderBy: { joinedAt: 'desc' },
  });

  successResponse(res, memberships.map(m => ({
    communityId: m.communityId,
    slug: m.community.slug,
    name: m.community.name,
    description: m.community.description,
    accentColor: m.community.accentColor,
    iconUrl: m.community.iconUrl,
    role: m.role,
    memberCount: m.community._count.members,
    joinedAt: m.createdAt,
  })));
});

// ─── Invite User ──────────────────────────────────────────────
router.post('/:id/invite', authenticate, async (req, res) => {
  const { inviteeId, email, message } = req.body;
  if (!inviteeId && !email) throw ApiError.badRequest('Provide inviteeId or email');

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
    throw ApiError.forbidden('Only community leaders can send invites');
  }

  // Check if invitee is already a member
  if (inviteeId) {
    const alreadyMember = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: inviteeId } },
    });
    if (alreadyMember) throw ApiError.conflict('User is already a member');
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

  if (action === 'accept') {
    await prisma.communityMember.create({
      data: { communityId: invite.communityId, userId: req.user.id, role: 'MEMBER' },
    });
    await prisma.communityInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    successResponse(res, { communityId: invite.communityId }, 'Invite accepted');
  } else {
    await prisma.communityInvite.update({
      where: { id: invite.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
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
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'PENDING') throw ApiError.conflict('Request already handled');

  if (action === 'accept') {
    await prisma.communityMember.create({
      data: { communityId: request.communityId, userId: request.userId, role: 'MEMBER' },
    });
    await prisma.communityRequest.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED', respondedAt: new Date(), responderId: req.user.id },
    });
    successResponse(res, { userId: request.userId }, 'Request accepted');
  } else {
    await prisma.communityRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED', respondedAt: new Date(), responderId: req.user.id },
    });
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

  const members = await prisma.communityMember.findMany({
    where: { communityId: community.id },
    include: {
      user: {
        select: {
          id: true, username: true, firstName: true, lastName: true, avatarUrl: true,
          workerProfile: { select: { level: true, tasksCompleted: true, totalEarned: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  const total = await prisma.communityMember.count({ where: { communityId: community.id } });

  // Sort by tasksCompleted descending
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
      totalEarned: m.user.workerProfile?.totalEarned || 0,
      joinedAt: m.createdAt,
    }))
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

  // Assign rank considering pagination offset
  const ranked = sorted.map((m, i) => ({ rank: skip + i + 1, ...m }));

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
  const where = { category: taskCat, status: 'OPEN' };

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
  const where = { category: taskCat, status: 'COMPLETED' };

  const [jobs, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true, title: true, reward: true, currency: true,
        category: true, completedAt: true,
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
      completedAt: j.submissions[0]?.completedAt || j.updatedAt,
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

  const messages = communityChats.get(community.id) || [];
  successResponse(res, messages.slice(-100)); // last 100 messages
});

// POST /:id/chat — members only
router.post('/:id/chat', authenticate, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) throw ApiError.badRequest('Message text is required');

  const community = await prisma.community.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership) throw ApiError.forbidden('Only community members can send messages');

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true },
  });

  const msg = {
    id: crypto.randomBytes(8).toString('hex'),
    communityId: community.id,
    sender: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    },
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  if (!communityChats.has(community.id)) {
    communityChats.set(community.id, []);
  }
  communityChats.get(community.id).push(msg);

  // Keep only last 500 messages
  const msgs = communityChats.get(community.id);
  if (msgs.length > 500) {
    communityChats.set(community.id, msgs.slice(-500));
  }

  createdResponse(res, msg, 'Message sent');
});

// ─── Social Links ─────────────────────────────────────────────
// PATCH /:id/socials — owner/admins only
router.patch('/:id/socials', authenticate, async (req, res) => {
  const { twitter, telegram, discord } = req.body;

  const community = await prisma.community.findUnique({ where: { id: req.params.id } });
  if (!community) throw ApiError.notFound('Community not found');

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: req.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw ApiError.forbidden('Only owners and admins can update social links');
  }

  const existing = communitySocials.get(community.id) || {};
  const updates = {};
  if (twitter !== undefined) updates.twitter = twitter;
  if (telegram !== undefined) updates.telegram = telegram;
  if (discord !== undefined) updates.discord = discord;
  communitySocials.set(community.id, { ...existing, ...updates });

  successResponse(res, communitySocials.get(community.id), 'Social links updated');
});

module.exports = router;
