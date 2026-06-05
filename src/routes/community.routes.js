'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse } = require('../utils/apiResponse');

const router = express.Router();

const communities = [
  { id: 'oga-raiders', name: 'Oga Raiders', category: 'social', badge: 'Social', members: 8204, tasks: 42, rewards: 45000, desc: 'The official OgaPay community. Task announcements, tips, and community support.', trending: true, accent: '#033CE3', initials: 'OR' },
  { id: 'solana-ng', name: 'Solana NG', category: 'crypto', badge: 'Crypto', members: 5112, tasks: 28, rewards: 32000, desc: 'Nigerian Solana enthusiasts. Learn, build, and earn on Solana.', trending: true, accent: '#16A34A', initials: 'SN' },
  { id: 'meme-hub', name: 'Meme Hub', category: 'content', badge: 'Content', members: 12490, tasks: 15, rewards: 18000, desc: 'Meme creation, contests, and viral content. Best memes win prizes.', trending: true, accent: '#D97706', initials: 'MH' },
  { id: 'design-studio', name: 'Design Studio', category: 'design', badge: 'Design', members: 3200, tasks: 22, rewards: 28000, desc: 'Graphic design, UI/UX, and branding collaborations.', trending: false, accent: '#EC4899', initials: 'DS' },
  { id: 'web3-dev', name: 'Web3 Devs', category: 'crypto', badge: 'Crypto', members: 1800, tasks: 35, rewards: 52000, desc: 'Smart contract development, dApp building, and web3 infrastructure.', trending: true, accent: '#8B5CF6', initials: 'WD' },
  { id: 'content-creators', name: 'Content Creators', category: 'content', badge: 'Content', members: 5600, tasks: 48, rewards: 41000, desc: 'Writing, video production, and content strategy.', trending: false, accent: '#22C55E', initials: 'CC' },
  { id: 'marketing-guild', name: 'Marketing Guild', category: 'marketing', badge: 'Marketing', members: 2400, tasks: 18, rewards: 22000, desc: 'Digital marketing, growth hacking, and brand strategy.', trending: false, accent: '#F5B301', initials: 'MG' },
  { id: 'business-network', name: 'Business Network', category: 'business', badge: 'Business', members: 1600, tasks: 12, rewards: 15000, desc: 'Entrepreneurship, partnerships, and B2B opportunities.', trending: false, accent: '#3B82F6', initials: 'BN' },
  { id: 'ai-automation', name: 'AI & Automation', category: 'crypto', badge: 'Crypto', members: 2900, tasks: 31, rewards: 34000, desc: 'AI agents, automation tools, and bot development.', trending: true, accent: '#A855F7', initials: 'AA' },
  { id: 'defi-ng', name: 'DeFi Nigeria', category: 'crypto', badge: 'Crypto', members: 4100, tasks: 25, rewards: 48000, desc: 'DeFi protocols, yield farming, and liquidity provision.', trending: true, accent: '#2563EB', initials: 'DN' },
];

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

router.get('/:id', async (req, res) => {
  const { ApiError } = require('../utils/apiResponse');
  const community = communities.find(c => c.id === req.params.id);
  if (!community) throw ApiError.notFound('Community not found');
  successResponse(res, {
    id: community.id,
    slug: community.id,
    name: community.name,
    description: community.desc,
    accentColor: community.accent,
    category: community.category,
    badge: community.badge,
    initials: community.initials,
    isPublic: true,
    trending: community.trending,
    owner: { firstName: 'OgaPay', lastName: 'Team', username: 'ogapay' },
    memberCount: community.members,
    taskCount: community.tasks,
    weeklyRewards: community.rewards,
  });
});

router.post('/:id/join', authenticate, async (req, res) => {
  const community = communities.find((item) => item.id === req.params.id);
  if (!community) {
    const { ApiError } = require('../utils/apiResponse');
    throw ApiError.notFound('Community not found');
  }
  createdResponse(res, { communityId: community.id, userId: req.user.id }, 'Joined community');
});

module.exports = router;
