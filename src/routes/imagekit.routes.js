'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getAuthParameters } = require('../config/imagekit');
const { ApiError } = require('../utils/apiResponse');

const router = express.Router();

router.get('/auth', authenticate, (req, res) => {
  const params = getAuthParameters();
  if (!params) throw ApiError.internal('ImageKit not configured');
  res.json({
    ...params,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
});

module.exports = router;
