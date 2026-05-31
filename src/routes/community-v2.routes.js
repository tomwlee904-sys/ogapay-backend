'use strict';
const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { successResponse, createdResponse, paginatedResponse, paginate, ApiError } = require('../utils/apiResponse');
const router = express.Router();

// Communities will be stored in DB or as static data for now
// Extended version with member management
const COMMUNITIES = [
  { id: 'naija-devs', name: 'Naija Devs', description: 'Nigerian developers building the future.', members: 1247, tasks: 12, accent: '#7C3AED', icon: 'code' },
  { id: 'crypto-ng', name: 'Crypto Nigeria', description: 'Crypto and web3 community for Nigerian earners.', members: 3560, tasks: 8, accent: '#2563EB', icon: 'coin' },
  { id: 'creators-hub', name: 'Creators Hub', description: 'For designers, writers, and content creators.', members: 892, tasks: 5, accent: '#f5b301', icon: 'palette' },
  { id: 'task-hunters', name: 'Task Hunters', description: 'Get notified about high-paying tasks first.', members: 2134, tasks: 24, accent: '#16a34a', icon: 'target' },
  { id: 'social-earners', name: 'Social Earners', description: 'Social media engagement tasks and tips.', members: 4891, tasks: 16, accent: '#ec4899', icon: 'brand-x' },
  { id: 'freelance-ng', name: 'Freelance NG', description: 'Freelancers across all niches.', members: 1578, tasks: 9, accent: '#6366f1', icon: 'briefcase' },
];

router.get('/', async (req, res) => {
  successResponse(res, COMMUNITIES);
});

router.get('/:id', async (req, res) => {
  const community = COMMUNITIES.find(c => c.id === req.params.id);
  if (!community) throw ApiError.notFound('Community not found');
  successResponse(res, community);
});

router.post('/:id/join', authenticate, async (req, res) => {
  const community = COMMUNITIES.find(c => c.id === req.params.id);
  if (!community) throw ApiError.notFound('Community not found');
  successResponse(res, { communityId: community.id, userId: req.user.id });
});

module.exports = router;
