'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, createdResponse } = require('../utils/apiResponse');

const router = express.Router();

const communities = [
  { id: 'oga-raiders', name: 'Oga Raiders', members: 8204, tasks: 42, accent: '#033CE3' },
  { id: 'solana-ng', name: 'Solana NG', members: 5112, tasks: 28, accent: '#16A34A' },
  { id: 'meme-hub', name: 'Meme Hub', members: 12490, tasks: 15, accent: '#D97706' },
];

router.get('/', async (req, res) => {
  successResponse(res, communities, 'Communities fetched');
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
