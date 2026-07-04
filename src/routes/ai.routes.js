'use strict';

const express = require('express');
const { prisma } = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');
const { ApiError, successResponse } = require('../utils/apiResponse');

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────
// CATEGORY KNOWLEDGE BASE
// ──────────────────────────────────────────────────────────────────────

const CATEGORY_PROFILES = {
  'Web & App Build': {
    keywords: ['website', 'web', 'app', 'platform', 'portal', 'dashboard', 'frontend', 'backend', 'fullstack', 'saas', 'api', 'landing page', 'ecommerce', 'e-commerce'],
    tags: ['web-development', 'frontend', 'backend', 'fullstack', 'react', 'nodejs', 'api', 'responsive', 'ui', 'database'],
    templates: [
      `Professional {name} built with modern architecture and responsive design. Every component is optimized for performance, accessibility, and cross-device compatibility. Includes clean code, full documentation, and 14 days of post-launch support. Perfect for startups and established businesses alike.`,
      `Custom {name} engineered to your exact specifications. Our senior developers follow industry best practices — modular architecture, comprehensive testing, and seamless deployment pipelines. Package includes source code, CI/CD setup, and technical documentation.`,
      `End-to-end {name} development from concept to deployment. We handle requirements analysis, UI/UX design, agile development, QA testing, and production launch. Built with scalability in mind so your solution grows with your business.`,
    ],
    priceRange: { min: 50, max: 500, suggested: 150 },
  },
  'Bots & Automations': {
    keywords: ['bot', 'automation', 'script', 'workflow', 'scraper', 'crawler', 'telegram bot', 'discord bot', 'trading bot', 'webhook'],
    tags: ['automation', 'bot', 'scripting', 'python', 'javascript', 'workflow', 'integration', 'webhook', 'cron', 'api'],
    templates: [
      `Reliable {name} built for 24/7 operation with error handling, logging, and recovery mechanisms. Whether you need workflow automation, data scraping, or a custom chatbot, this solution runs autonomously with minimal oversight. Includes deployment guide and monitoring setup.`,
      `Custom {name} designed to eliminate repetitive tasks and streamline your operations. Features include scheduled execution, webhook integrations, detailed logging, and fault tolerance. Deployable on any cloud platform or on-premise server.`,
      `Automate your workflow with this {name}. Handles complex multi-step processes, API integrations, and data processing pipelines. Includes comprehensive error handling, rate limiting, and performance analytics dashboard.`,
    ],
    priceRange: { min: 30, max: 300, suggested: 80 },
  },
  'Blockchain & Crypto Dev': {
    keywords: ['blockchain', 'crypto', 'smart contract', 'solidity', 'solana', 'nft', 'defi', 'dapp', 'web3', 'wallet', 'token', 'metamask', 'ethereum'],
    tags: ['blockchain', 'web3', 'smart-contract', 'solana', 'solidity', 'nft', 'defi', 'dapp', 'crypto', 'tokenomics'],
    templates: [
      `Secure {name} developed with comprehensive auditing and testing. Our blockchain specialists implement battle-tested patterns, multi-signature safeguards, and gas-optimized code. Includes testnet deployment, verification, and deployment support on mainnet.`,
      `Production-grade {name} built for the Web3 ecosystem. Smart contracts are written with formal verification patterns, extensive test coverage, and upgradeability considerations. Package includes deployment scripts, documentation, and security audit report.`,
      `Full-cycle {name} development from architecture design to mainnet launch. Features include tokenomics modeling, smart contract development, dApp frontend integration, and post-launch monitoring. Built with security-first principles throughout.`,
    ],
    priceRange: { min: 100, max: 1000, suggested: 350 },
  },
  'Data & Dashboards': {
    keywords: ['data', 'dashboard', 'analytics', 'report', 'visualization', 'spreadsheet', 'excel', 'database', 'charts', 'metrics', 'kpi'],
    tags: ['data-analysis', 'dashboard', 'visualization', 'analytics', 'excel', 'sql', 'python', 'charts', 'reporting', 'metrics'],
    templates: [
      `Comprehensive {name} that transforms raw data into actionable insights. Features interactive visualizations, drill-down capabilities, automated refresh schedules, and export functionality. Built with your specific KPIs and reporting requirements in mind.`,
      `Custom {name} designed to give you real-time visibility into your business metrics. Includes data pipeline setup, ETL processes, interactive dashboards, and scheduled report delivery. Clean, intuitive interface that your whole team can use.`,
      `Turn your data into decisions with this {name}. Connects to multiple data sources, processes and cleanses raw data, and presents insights through beautiful, interactive visualizations. Includes custom alert thresholds and trend analysis.`,
    ],
    priceRange: { min: 20, max: 200, suggested: 75 },
  },
  'AI & Machine Learning': {
    keywords: ['ai', 'machine learning', 'ml', 'chatbot', 'gpt', 'llm', 'neural', 'deep learning', 'model', 'training', 'prediction', 'classification', 'nlp', 'computer vision'],
    tags: ['ai', 'machine-learning', 'deep-learning', 'nlp', 'computer-vision', 'chatbot', 'gpt', 'llm', 'automation', 'intelligence'],
    templates: [
      `Advanced {name} powered by state-of-the-art machine learning models. Our AI specialists fine-tune models on your specific data to deliver accurate, production-ready predictions. Includes model training, evaluation, API endpoint, and performance monitoring.`,
      `Custom {name} solution tailored to your unique requirements. From data collection and preprocessing to model selection, training, and deployment — we handle the entire ML pipeline. Delivered with comprehensive documentation and model cards.`,
      `Production-ready {name} with a focus on accuracy, scalability, and maintainability. We select the optimal architecture for your use case, train on curated datasets, and deploy with CI/CD pipelines. Includes A/B testing framework and drift monitoring.`,
    ],
    priceRange: { min: 50, max: 500, suggested: 200 },
  },
  'Graphics & Design': {
    keywords: ['logo', 'branding', 'design', 'ui', 'ux', 'figma', 'photoshop', 'illustration', 'creative', 'graphic', 'flyer', 'poster', 'social media', 'banner'],
    tags: ['design', 'graphic-design', 'logo', 'branding', 'ui-ux', 'figma', 'photoshop', 'illustration', 'creative', 'visual'],
    templates: [
      `Premium {name} crafted with meticulous attention to detail and creative excellence. Each project begins with thorough research and mood boarding, followed by iterative concept development and refinement. Delivered in all major formats with full commercial rights.`,
      `Stand out with bespoke {name} designed to capture your brand's unique identity. Our experienced designers blend aesthetic excellence with strategic thinking to create visuals that resonate with your target audience. Includes source files and brand guidelines.`,
      `Professional {name} that elevates your brand presence across all touchpoints. From initial sketches to final polished assets, every element is purposefully designed. Package includes multiple concepts, revision rounds, and format variations for web and print.`,
    ],
    priceRange: { min: 10, max: 150, suggested: 45 },
  },
  'Video & Animation': {
    keywords: ['video', 'animation', 'motion', 'editing', 'after effects', 'premiere', 'mograph', 'explainer', 'promo', 'trailer', 'youtube', 'tiktok'],
    tags: ['video', 'animation', 'motion-graphics', 'editing', 'after-effects', 'premiere-pro', 'explainer', 'visual-effects', 'production', 'cinematic'],
    templates: [
      `Cinematic {name} produced with professional-grade equipment and techniques. From concept development and storyboarding to final color grading and sound design — every frame is crafted to tell your story effectively. Includes revisions and multiple format exports.`,
      `Engaging {name} designed to captivate your audience and communicate your message clearly. Our production pipeline covers scripting, voiceover, animation, music selection, and final rendering. Optimized for both social media and broadcast platforms.`,
      `High-impact {name} that combines creative storytelling with technical excellence. We handle pre-production planning, motion design, visual effects, and professional audio mixing. Delivered in HD/4K with custom aspect ratios for any platform.`,
    ],
    priceRange: { min: 30, max: 300, suggested: 120 },
  },
  'Music & Audio': {
    keywords: ['music', 'audio', 'mixing', 'mastering', 'sound', 'voiceover', 'production', 'podcast', 'beat', 'composition', 'recording'],
    tags: ['audio', 'mixing', 'mastering', 'sound-design', 'voiceover', 'production', 'podcast', 'music', 'recording', 'post-production'],
    templates: [
      `Professional {name} delivered with broadcast-quality standards. Our audio engineers use industry-leading equipment and processing chains to achieve pristine clarity, balanced frequency response, and optimal loudness levels. Includes stereo and mono exports.`,
      `Studio-quality {name} with meticulous attention to sonic detail. From noise reduction and compression to EQ sculpting and spatial enhancement — every element is polished to perfection. Ready for streaming platforms, broadcast, or live performance.`,
      `Complete {name} service covering recording, editing, mixing, and mastering. We work with your raw material to produce a clean, punchy, professionally balanced final product. Includes reference tracks and format variants for different platforms.`,
    ],
    priceRange: { min: 15, max: 150, suggested: 50 },
  },
  'Writing & Translation': {
    keywords: ['writing', 'content', 'copywriting', 'translation', 'proofreading', 'editing', 'blog', 'article', 'seo', 'copy', 'script', 'newsletter'],
    tags: ['writing', 'content-writing', 'copywriting', 'translation', 'proofreading', 'seo', 'editing', 'blog', 'article', 'creative-writing'],
    templates: [
      `Polished {name} crafted by experienced writers who understand your audience and objectives. Every piece is researched, structured, and refined to deliver maximum impact. Includes SEO optimization, headline variants, source citations, and unlimited revisions within scope.`,
      `Compelling {name} tailored to your brand voice and marketing goals. Our writers combine strategic messaging with engaging prose to drive reader action. Includes keyword research, meta descriptions, readability optimization, and plagiarism-free guarantee.`,
      `Professional {name} service delivering clear, accurate, and engaging content. Each project undergoes rigorous quality checks including factual verification, grammar review, and style consistency. Available in multiple languages and formats.`,
    ],
    priceRange: { min: 10, max: 100, suggested: 35 },
  },
  'Social & Growth Web3': {
    keywords: ['social', 'growth', 'community', 'twitter', 'discord', 'engagement', 'web3', 'crypto twitter', 'ct', 'influencer', 'shill', 'marketing'],
    tags: ['social-media', 'growth', 'community-management', 'twitter', 'discord', 'engagement', 'web3', 'content-strategy', 'influencer', 'organic-growth'],
    templates: [
      `Strategic {name} designed to build and engage your Web3 community. Our growth specialists implement proven tactics for Twitter, Discord, and Telegram — including content calendars, engagement campaigns, and community building frameworks. Includes weekly performance reports.`,
      `Results-driven {name} that grows your social presence organically. We focus on authentic engagement, value-driven content, and community building rather than vanity metrics. Includes competitor analysis, content strategy, and monthly growth audits.`,
      `Comprehensive {name} package covering content creation, community management, and growth optimization. Our team stays current with platform algorithms and Web3 community trends to ensure your brand stays ahead. Includes crisis management protocols.`,
    ],
    priceRange: { min: 20, max: 200, suggested: 65 },
  },
  'Marketing & Ads': {
    keywords: ['marketing', 'ads', 'seo', 'campaign', 'conversion', 'audience', 'cpm', 'cpc', 'funnel', 'retargeting', 'influencer', 'ppc'],
    tags: ['marketing', 'advertising', 'seo', 'campaign-management', 'ppc', 'social-media-ads', 'conversion', 'analytics', 'funnel', 'retargeting'],
    templates: [
      `Data-driven {name} engineered to maximize ROI and minimize customer acquisition costs. Our marketing strategists design multi-channel campaigns with precise targeting, A/B testing, and continuous optimization. Includes funnel analysis, attribution modeling, and monthly performance reviews.`,
      `Results-oriented {name} built on deep audience research and competitive analysis. We craft compelling ad creative, optimize landing pages, and refine targeting parameters to deliver qualified leads. Full transparency with real-time dashboard and weekly optimization reports.`,
      `Full-funnel {name} strategy covering awareness, consideration, and conversion stages. Combines paid media, content marketing, and retargeting to create a cohesive customer journey. Includes budget optimization, creative rotation, and detailed ROI analysis.`,
    ],
    priceRange: { min: 30, max: 300, suggested: 100 },
  },
  'Community Raids & Engagement': {
    keywords: ['raid', 'engagement', 'community', 'telegram', 'discord', 'organic', 'growth', 'active', 'members', 'participation'],
    tags: ['community', 'engagement', 'telegram', 'discord', 'organic-growth', 'active-members', 'participation', 'moderation', 'events', 'loyalty'],
    templates: [
      `Active {name} campaign designed to boost participation and strengthen community bonds. Our engagement specialists run structured activities, discussions, and events that keep members active and invested. Includes moderation support and engagement analytics.`,
      `Organic {name} strategy focused on quality interactions and sustainable community growth. We design reward systems, discussion prompts, and collaborative activities that encourage genuine participation. Includes member retention analysis and sentiment tracking.`,
      `Structured {name} program with daily, weekly, and monthly engagement cadences. From AMAs and contests to collaborative projects and feedback sessions — every activity is designed to build a thriving, self-sustaining community.`,
    ],
    priceRange: { min: 10, max: 100, suggested: 30 },
  },
  'Product & Operations': {
    keywords: ['product', 'operations', 'project management', 'agile', 'qa', 'testing', 'process', 'workflow', 'scrum', 'sprint', 'roadmap'],
    tags: ['product-management', 'operations', 'project-management', 'agile', 'scrum', 'qa', 'testing', 'process-optimization', 'workflow', 'strategy'],
    templates: [
      `End-to-end {name} service covering planning, execution, and delivery. Our experienced PMs implement agile methodologies, establish clear communication channels, and maintain rigorous quality standards. Includes sprint planning, retrospectives, and stakeholder reporting.`,
      `Professional {name} optimized for efficiency and quality outcomes. We assess your current workflows, identify bottlenecks, and implement streamlined processes that reduce friction and increase throughput. Includes process documentation and team training materials.`,
      `Comprehensive {name} solution for teams needing structure and accountability. We set up project tracking systems, define clear roles and responsibilities, establish SLA frameworks, and provide regular status reporting. Keeps everyone aligned and on schedule.`,
    ],
    priceRange: { min: 50, max: 400, suggested: 150 },
  },
  'Consulting & Advisory': {
    keywords: ['consulting', 'advisory', 'strategy', 'mentorship', 'roadmap', 'planning', 'guidance', 'expert', 'advise', 'coaching'],
    tags: ['consulting', 'advisory', 'strategy', 'mentorship', 'roadmap', 'planning', 'expert-guidance', 'coaching', 'analysis', 'recommendation'],
    templates: [
      `Expert {name} delivered by industry veterans with proven track records. Our consultants provide actionable insights, strategic roadmaps, and practical recommendations based on deep domain expertise and extensive market research. Includes deliverables and follow-up session.`,
      `Strategic {name} session designed to clarify your vision, identify opportunities, and chart a path forward. We combine structured frameworks with practical experience to deliver insights you can immediately act on. Includes summary report and resource recommendations.`,
      `Tailored {name} addressing your specific challenges and goals. Through thorough analysis and collaborative problem-solving, we develop customized strategies that account for your unique context, resources, and constraints. Ongoing support available.`,
    ],
    priceRange: { min: 80, max: 600, suggested: 250 },
  },
};

const DEFAULT_PROFILE = {
  keywords: [],
  tags: ['custom', 'service', 'professional', 'quality', 'reliable'],
  templates: [
    `Professional {name} delivered with attention to quality and detail. Every project is handled with care, clear communication, and a commitment to exceeding expectations. Reach out to discuss your specific requirements and timeline.`,
    `Custom {name} tailored to your needs. I work closely with clients to understand requirements and deliver results that align with your vision. Quality, reliability, and client satisfaction are my top priorities.`,
  ],
  priceRange: { min: 15, max: 150, suggested: 50 },
};

// ──────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────

function findProfile(category) {
  return CATEGORY_PROFILES[category] || DEFAULT_PROFILE;
}

function matchKeywords(name, keywords) {
  if (!name) return [];
  const lower = name.toLowerCase();
  return keywords.filter(kw => lower.includes(kw));
}

function suggestTags(name, category) {
  const profile = findProfile(category);
  const matched = matchKeywords(name, profile.keywords);
  const matchedTagVariants = matched.map(kw => kw.replace(/\s+/g, '-').toLowerCase());
  const baseTags = profile.tags.slice();
  // Put matched keyword tags first, then fill with category defaults
  const unique = [...new Set([...matchedTagVariants, ...baseTags])];
  return unique.slice(0, 8);
}

function pickTemplate(name, category) {
  const profile = findProfile(category);
  const idx = Math.floor(Math.random() * profile.templates.length);
  return profile.templates[idx].replace(/\{name\}/g, name);
}

// ──────────────────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────────────────

/**
 * POST /ai/suggest
 * Suggests tags and price for a product based on name + category.
 * Uses DB averages when available, falls back to category profiles.
 */
router.post('/suggest', authenticate, async (req, res) => {
  const { name, category } = req.body || {};
  if (!name) throw ApiError.badRequest('Product name is required');

  const profile = findProfile(category);

  // Try to get real price data from DB
  let avgPrice = null;
  try {
    const stats = await prisma.storeItem.aggregate({
      where: { category, isActive: true },
      _avg: { price: true },
      _count: true,
    });
    if (stats._count > 0 && stats._avg.price) {
      avgPrice = {
        average: Number(stats._avg.price.toFixed(2)),
        sampleSize: stats._count,
      };
    }
  } catch (_) { /* ignore DB errors */ }

  // Suggested price: prefer DB average, else use profile suggested mid-range
  const priceSuggestion = avgPrice
    ? avgPrice.average
    : profile.priceRange.suggested;

  const tags = suggestTags(name, category);

  successResponse(res, {
    tags,
    priceSuggestion,
    priceRange: profile.priceRange,
    pricingSource: avgPrice ? ('Based on ' + avgPrice.sampleSize + ' similar products') : 'Category estimate',
  }, 'Suggestions generated');
});

/**
 * POST /ai/generate-description
 * Generates a professional product description without LLM.
 */
router.post('/generate-description', authenticate, async (req, res) => {
  const { name, category } = req.body || {};
  if (!name) throw ApiError.badRequest('Product name is required');

  const description = pickTemplate(name, category);

  successResponse(res, {
    description,
    generated: true,
  }, 'Description generated');
});

/**
 * POST /ai/suggest-all
 * Combined endpoint: returns tags, price, and description in one call.
 */
router.post('/suggest-all', authenticate, async (req, res) => {
  const { name, category } = req.body || {};
  if (!name) throw ApiError.badRequest('Product name is required');

  const profile = findProfile(category);
  const tags = suggestTags(name, category);
  const priceSuggestion = profile.priceRange.suggested;
  const description = pickTemplate(name, category);

  successResponse(res, {
    tags,
    priceSuggestion,
    priceRange: profile.priceRange,
    description,
  }, 'All suggestions generated');
});

/**
 * POST /ai/task-copy
 * Generates task instructions without LLM (legacy endpoint).
 */
router.post('/task-copy', authenticate, async (req, res) => {
  const { mode = 'Social', platform = 'X', category = 'Social' } = req.body || {};

  const instructions = [
    '1. Open the campaign link and review the requirements carefully.',
    '2. Complete the requested ' + mode.toLowerCase() + ' action on ' + platform + ' according to the instructions.',
    '3. Allow the action to process fully before capturing your proof.',
    '4. Take a clear screenshot showing both your ' + platform + ' username and the completed action.',
    '5. Submit your proof through the task submission form.',
  ].join('\\n');

  successResponse(res, {
    title: 'Complete ' + category + ' task on ' + platform,
    instructions,
    tips: 'Make sure your ' + platform + ' profile is public so we can verify your submission.',
  }, 'Task copy generated');
});

/**
 * POST /ai/chat
 * Simple FAQ-style assistant without LLM.
 */
router.post('/chat', authenticate, async (req, res) => {
  const { question } = req.body || {};
  if (!question) throw ApiError.badRequest('Question is required');

  const lower = question.toLowerCase();
  let answer;

  if (lower.includes('refund') || lower.includes('cancel')) {
    answer = 'Refunds and cancellations are handled on a case-by-case basis. Please contact our support team through the Support page with your order details and we will assist you within 24 hours.';
  } else if (lower.includes('how long') || lower.includes('delivery') || lower.includes('shipping')) {
    answer = 'Delivery times vary by service category. Most digital services are delivered within 1-14 days as specified in the product listing. If you need faster delivery, check with the seller before placing your order.';
  } else if (lower.includes('payment') || lower.includes('pay') || lower.includes('wallet')) {
    answer = 'OgaPay supports payments in NGN, USDC, and SOL. Funds are held in escrow and released to the seller once you confirm satisfaction with the delivered work. This protects both buyers and sellers.';
  } else if (lower.includes('dispute') || lower.includes('problem') || lower.includes('issue')) {
    answer = "If you encounter any issues with an order, first communicate directly with the seller. If you can't resolve it, open a dispute through the order page within 7 days of delivery. Our moderation team will review both sides and make a fair decision.";
  } else if (lower.includes('commission') || lower.includes('fee') || lower.includes('charge')) {
    answer = 'OgaPay charges a 10% platform fee on completed transactions. This covers payment processing, dispute resolution, fraud protection, and platform maintenance. There are no fees for browsing, listing, or messaging.';
  } else if (lower.includes('verify') || lower.includes('kyc') || lower.includes('identity')) {
    answer = 'Identity verification (KYC) is available in your Profile settings. While not required for all features, verified users get higher transaction limits and increased trust from potential buyers and sellers.';
  } else if (lower.includes('seller') || lower.includes('list') || lower.includes('create') || lower.includes('product')) {
    answer = 'To sell on OgaPay, navigate to My Store and click "Add New Product". Fill in your product details, set a price, and publish. Once active, your product will appear in the Store for buyers to discover.';
  } else {
    answer = "Thanks for reaching out! I couldn't find a specific answer to your question. Please visit our FAQ page or contact support for personalized assistance. We typically respond within 24 hours.";
  }

  successResponse(res, { answer }, 'Chat response generated');
});

module.exports = router;
