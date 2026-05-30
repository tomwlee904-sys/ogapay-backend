'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { ApiError, successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.post('/task-copy', authenticate, async (req, res) => {
  const { mode = 'Social', platform = 'X', category = 'Social' } = req.body || {};
  if (!process.env.ANTHROPIC_API_KEY) {
    successResponse(res, {
      title: `Complete a ${category} task on ${platform}`,
      instructions: [
        `1. Open the campaign link and complete the requested ${mode.toLowerCase()} action.`,
        `2. Keep your action visible until review is complete.`,
        '3. Submit proof that clearly shows your username and completion.',
      ].join('\n'),
      fallback: true,
    }, 'Fallback task copy generated');
    return;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 350,
      messages: [{
        role: 'user',
        content: `Return JSON with title and instructions for an OgaPay microjob. mode=${mode}; platform=${platform}; category=${category}.`,
      }],
    }),
  });

  const json = await response.json();
  if (!response.ok) throw ApiError.internal(json.error?.message || 'AI generation failed');
  const text = json.content?.[0]?.text || '{}';
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
  successResponse(res, parsed, 'Task copy generated');
});

module.exports = router;
