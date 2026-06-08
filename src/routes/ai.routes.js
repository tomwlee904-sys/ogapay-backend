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

router.post('/generate-description', authenticate, async (req, res) => {
  const { name, category, keywords } = req.body || {};
  if (!name) throw ApiError.badRequest('Product name is required');

  if (!process.env.ANTHROPIC_API_KEY) {
    const templates = {
      design: [
        `Professional ${name} crafted with precision and creativity. Perfect for businesses looking to establish a strong visual identity. Each design is tailored to your brand's unique voice and includes high-resolution files, source formats, and unlimited revisions within 7 days. Stand out from the competition with design that speaks volumes.`,
        `Transform your brand with our ${name} service. Our experienced designers work closely with you to understand your vision and deliver stunning visuals that capture attention. Package includes mood boards, initial concepts, revision rounds, and final deliverables in all major formats.`,
      ],
      social: [
        `Supercharge your social media presence with our ${name} package. Includes strategic content creation, scheduled posting, engagement tracking, and monthly performance reports. We tailor content to each platform's best practices to maximize reach and engagement for your brand.`,
        `Get more followers, likes, and engagement with our ${name} campaign. We use proven growth strategies to boost your social media presence organically. Includes content calendar, daily engagement, and weekly analytics reporting.`,
      ],
      marketing: [
        `Drive results with our comprehensive ${name} marketing solution. We combine data-driven strategies with creative execution to deliver measurable ROI. Includes campaign setup, audience targeting, A/B testing, and detailed performance analytics.`,
        `Our ${name} service helps you reach the right audience at the right time. From strategy development to execution and optimization, we handle every aspect of your marketing campaign. Includes funnel analysis and conversion tracking.`,
      ],
      dev: [
        `Custom ${name} built with modern technologies and best practices. Our experienced developers deliver clean, scalable, and well-documented code. Includes source code, deployment support, and 30 days of post-launch maintenance.`,
        `Need a ${name}? We build robust, performant solutions tailored to your requirements. Using agile methodology, we deliver on time and within budget. Includes CI/CD setup, documentation, and technical support.`,
      ],
      content: [
        `Engaging ${name} tailored to your audience and brand voice. Our skilled writers research, draft, and polish content that resonates with your target market. Includes SEO optimization, headline variants, and source citations.`,
        `High-quality ${name} that tells your story and drives action. Whether you need blog posts, articles, or copy for your website, we deliver compelling content that converts. Includes keyword research and meta descriptions.`,
      ],
      crypto: [
        `${name} — navigate the crypto space with confidence. Our blockchain specialists provide secure, efficient solutions tailored to Web3 projects. Includes smart contract review, tokenomics analysis, and best practice recommendations.`,
        `Expert ${name} services for blockchain and crypto projects. From wallet setup to DeFi strategies, we help you leverage decentralized technology effectively. Includes security audit checklist and gas optimization tips.`,
      ],
      ai: [
        `Leverage cutting-edge AI with our ${name} service. We integrate the latest machine learning models to automate workflows, generate insights, and enhance decision-making. Includes model selection guidance, prompt engineering, and performance benchmarks.`,
        `Future-proof your business with our ${name} solution. Our AI specialists customize models for your specific use case, ensuring accurate and reliable results. Includes training data preparation, model fine-tuning, and deployment support.`,
      ],
      templates: [
        `Get started fast with our premium ${name}. Professionally designed, fully customizable, and ready to use. Includes source files, documentation, and lifetime updates. Perfect for businesses and creators who need quality assets quickly.`,
        `Our ${name} saves you hours of design work. Each template is meticulously crafted with attention to detail and follows current design trends. Includes multiple format options and detailed customization guide.`,
      ],
    };
    const catTemplates = templates[category] || templates.design;
    const description = catTemplates[Math.floor(Math.random() * catTemplates.length)];
    successResponse(res, { description, fallback: true }, 'Description generated');
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
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Generate a compelling product description (2-4 sentences) for a product called "${name}" in the "${category}" category on OgaPay marketplace. ${keywords ? `Keywords to include: ${keywords}.` : ''} Return ONLY a JSON object with a "description" field. No markdown, no code fences.`,
      }],
    }),
  });

  const json = await response.json();
  if (!response.ok) throw ApiError.internal(json.error?.message || 'AI generation failed');
  const text = json.content?.[0]?.text || '{}';
  const clean = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || '{}');
  if (!parsed.description) throw ApiError.internal('AI returned an empty result');
  successResponse(res, { description: parsed.description, fallback: false }, 'Description generated');
});

module.exports = router;
