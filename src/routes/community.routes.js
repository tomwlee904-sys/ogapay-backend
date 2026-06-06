'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse } = require('../utils/apiResponse');

const router = express.Router();

let communities = [
  { id: 'oga-raiders', name: 'Oga Raiders', category: 'social', badge: 'Social', members: 8204, tasks: 42, rewards: 45000, desc: 'The official OgaPay community. Task announcements, tips, and community support.', trending: true, accent: '#033CE3', initials: 'OR', isPublic: true, ownerId: null },
  { id: 'solana-ng', name: 'Solana NG', category: 'crypto', badge: 'Crypto', members: 5112, tasks: 28, rewards: 32000, desc: 'Nigerian Solana enthusiasts. Learn, build, and earn on Solana.', trending: true, accent: '#16A34A', initials: 'SN', isPublic: true, ownerId: null },
  { id: 'meme-hub', name: 'Meme Hub', category: 'content', badge: 'Content', members: 12490, tasks: 15, rewards: 18000, desc: 'Meme creation, contests, and viral content. Best memes win prizes.', trending: true, accent: '#D97706', initials: 'MH', isPublic: true, ownerId: null },
  { id: 'design-studio', name: 'Design Studio', category: 'design', badge: 'Design', members: 3200, tasks: 22, rewards: 28000, desc: 'Graphic design, UI/UX, and branding collaborations.', trending: false, accent: '#EC4899', initials: 'DS', isPublic: true, ownerId: null },
  { id: 'web3-dev', name: 'Web3 Devs', category: 'crypto', badge: 'Crypto', members: 1800, tasks: 35, rewards: 52000, desc: 'Smart contract development, dApp building, and web3 infrastructure.', trending: true, accent: '#8B5CF6', initials: 'WD', isPublic: true, ownerId: null },
  { id: 'content-creators', name: 'Content Creators', category: 'content', badge: 'Content', members: 5600, tasks: 48, rewards: 41000, desc: 'Writing, video production, and content strategy.', trending: false, accent: '#22C55E', initials: 'CC', isPublic: true, ownerId: null },
  { id: 'marketing-guild', name: 'Marketing Guild', category: 'marketing', badge: 'Marketing', members: 2400, tasks: 18, rewards: 22000, desc: 'Digital marketing, growth hacking, and brand strategy.', trending: false, accent: '#F5B301', initials: 'MG', isPublic: true, ownerId: null },
  { id: 'business-network', name: 'Business Network', category: 'business', badge: 'Business', members: 1600, tasks: 12, rewards: 15000, desc: 'Entrepreneurship, partnerships, and B2B opportunities.', trending: false, accent: '#3B82F6', initials: 'BN', isPublic: true, ownerId: null },
  { id: 'ai-automation', name: 'AI & Automation', category: 'crypto', badge: 'Crypto', members: 2900, tasks: 31, rewards: 34000, desc: 'AI agents, automation tools, and bot development.', trending: true, accent: '#A855F7', initials: 'AA', isPublic: true, ownerId: null },
  { id: 'defi-ng', name: 'DeFi Nigeria', category: 'crypto', badge: 'Crypto', members: 4100, tasks: 25, rewards: 48000, desc: 'DeFi protocols, yield farming, and liquidity provision.', trending: true, accent: '#2563EB', initials: 'DN', isPublic: true, ownerId: null },
];

// In-memory store for user communities, invites, requests
const userCommunities = new Map(); // userId -> Set<communityId>
const joinRequests = new Map(); // communityId -> Array<{userId, username}>
const invites = new Map(); // communityId -> Array<{userId, invitedBy, username}>

router.get('/', async (req, res) => {
  const { search } = req.query;
  let result = communities;
  if (search) {
    const q = search.toLowerCase();
    result = communities.filter(c => c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.badge.toLowerCase().includes(q));
  }
  successResponse(res, {
    communities: result,
    stats: { total: communities.length, members: communities.reduce((s, c) => s + c.members, 0), tasks: communities.reduce((s, c) => s + c.tasks, 0), rewards: communities.reduce((s, c) => s + c.rewards, 0) },
    trending: result.filter(c => c.trending),
  });
});

// GET /api/v1/communities/my — User's communities
router.get('/my', authenticate, async (req, res) => {
  const userComs = userCommunities.get(req.user.id) || new Set();
  const myComs = communities.filter(c => userComs.has(c.id));
  successResponse(res, myComs, 'My communities fetched');
});

// POST /api/v1/communities — Create community
router.post('/', authenticate, async (req, res) => {
  const { name, category, description } = req.body;
  if (!name || !name.trim()) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.badRequest('Community name is required');
  }
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const catMap = {
    crypto: { badge: 'Crypto', accent: '#1F8CFF' },
    social: { badge: 'Social', accent: '#033CE3' },
    design: { badge: 'Design', accent: '#EC4899' },
    content: { badge: 'Content', accent: '#22C55E' },
    marketing: { badge: 'Marketing', accent: '#F5B301' },
    business: { badge: 'Business', accent: '#3B82F6' },
  };
  const cat = catMap[category] || { badge: 'General', accent: '#666' };
  
  const newCommunity = {
    id, name: name.trim(), category: category || 'social', badge: cat.badge,
    members: 1, tasks: 0, rewards: 0, desc: description || '', trending: false,
    accent: cat.accent, initials, isPublic: true, ownerId: req.user.id,
  };
  communities.unshift(newCommunity);
  
  // Auto-join the creator
  if (!userCommunities.has(req.user.id)) userCommunities.set(req.user.id, new Set());
  userCommunities.get(req.user.id).add(id);
  
  createdResponse(res, newCommunity, 'Community created');
});

router.get('/:id', async (req, res) => {
  const { ApiError } = require('../utils/apiResponse');
  const community = communities.find(c => c.id === req.params.id);
  if (!community) throw ApiError.notFound('Community not found');
  
  const comRequests = joinRequests.get(req.params.id) || [];
  const comInvites = invites.get(req.params.id) || [];
  
  successResponse(res, {
    id: community.id,
    slug: community.id,
    name: community.name,
    description: community.desc,
    accentColor: community.accent,
    category: community.category,
    badge: community.badge,
    initials: community.initials,
    isPublic: community.isPublic,
    trending: community.trending,
    memberCount: community.members,
    taskCount: community.tasks,
    weeklyRewards: community.rewards,
    ownerId: community.ownerId,
    requestCount: comRequests.length,
    inviteCount: comInvites.length,
  });
});

// POST /api/v1/communities/:id/join
router.post('/:id/join', authenticate, async (req, res) => {
  const community = communities.find((item) => item.id === req.params.id);
  if (!community) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Community not found');
  }
  if (!userCommunities.has(req.user.id)) userCommunities.set(req.user.id, new Set());
  userCommunities.get(req.user.id).add(community.id);
  community.members += 1;
  createdResponse(res, { communityId: community.id, userId: req.user.id }, 'Joined community');
});

// POST /api/v1/communities/:id/request — Request to join
router.post('/:id/request', authenticate, async (req, res) => {
  const community = communities.find(c => c.id === req.params.id);
  if (!community) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Community not found');
  }
  if (!joinRequests.has(req.params.id)) joinRequests.set(req.params.id, []);
  joinRequests.get(req.params.id).push({
    userId: req.user.id,
    username: req.body.username || req.user.username || 'User',
    createdAt: new Date().toISOString(),
  });
  createdResponse(res, { communityId: community.id }, 'Request sent');
});

// GET /api/v1/communities/:id/requests — List join requests (owner only)
router.get('/:id/requests', authenticate, async (req, res) => {
  const community = communities.find(c => c.id === req.params.id);
  if (!community) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Community not found');
  }
  if (community.ownerId !== req.user.id) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.forbidden('Only the community owner can view requests');
  }
  successResponse(res, joinRequests.get(req.params.id) || [], 'Requests fetched');
});

// POST /api/v1/communities/:id/request/:userId/approve — Approve join request
router.post('/:id/request/:userId/approve', authenticate, async (req, res) => {
  const community = communities.find(c => c.id === req.params.id);
  if (!community) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Community not found');
  }
  if (community.ownerId !== req.user.id) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.forbidden('Only the community owner can approve requests');
  }
  const requests = joinRequests.get(req.params.id) || [];
  const idx = requests.findIndex((r) => r.userId === req.params.userId);
  if (idx === -1) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Request not found');
  }
  requests.splice(idx, 1);
  if (!userCommunities.has(req.params.userId)) userCommunities.set(req.params.userId, new Set());
  userCommunities.get(req.params.userId).add(community.id);
  community.members += 1;
  successResponse(res, { communityId: community.id, userId: req.params.userId }, 'Request approved');
});

// PATCH /api/v1/communities/:id — Update community
router.patch('/:id', authenticate, async (req, res) => {
  const community = communities.find(c => c.id === req.params.id);
  if (!community) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Community not found');
  }
  if (community.ownerId !== req.user.id) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.forbidden('Only the community owner can update settings');
  }
  const { name, description, category, isPublic } = req.body;
  if (name) community.name = name;
  if (description !== undefined) community.desc = description;
  if (category) {
    const catMap = {
      crypto: { badge: 'Crypto', accent: '#1F8CFF' },
      social: { badge: 'Social', accent: '#033CE3' },
      design: { badge: 'Design', accent: '#EC4899' },
      content: { badge: 'Content', accent: '#22C55E' },
      marketing: { badge: 'Marketing', accent: '#F5B301' },
      business: { badge: 'Business', accent: '#3B82F6' },
    };
    const cat = catMap[category] || { badge: 'General', accent: '#666' };
    community.category = category;
    community.badge = cat.badge;
    community.accent = cat.accent;
  }
  if (isPublic !== undefined) community.isPublic = isPublic;
  successResponse(res, community, 'Community updated');
});

module.exports = router;
