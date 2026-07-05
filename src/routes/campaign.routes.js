'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { successResponse, ApiError } = require('../utils/apiResponse');
const Groq = require('groq-sdk');
const prisma = require("../lib/prisma");

// GET /api/v1/campaigns/qualification — Pre-qualification check before campaign creation
router.get("/qualification", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        isEmailVerified: true,
        isPhoneVerified: true,
        walletAddress: true,
        phone: true,
        createdAt: true,
        kyc: { select: { status: true } },
      },
    });
    if (!user) throw new ApiError(404, "User not found");

    const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const kycStatus = user.kyc?.status || null;

    const checks = {
      kycVerified: kycStatus === "APPROVED",
      emailConfirmed: user.isEmailVerified,
      walletConnected: !!user.walletAddress,
      accountAgeMet: accountAgeDays >= 7,
      phoneVerified: user.isPhoneVerified,
    };

    const allPassed = Object.values(checks).every(Boolean);

    const details = {
      kyc: { status: kycStatus, passed: checks.kycVerified, actionUrl: "/settings?tab=kyc" },
      email: { verified: user.isEmailVerified, passed: checks.emailConfirmed, actionUrl: "/settings?tab=account" },
      wallet: { connected: !!user.walletAddress, passed: checks.walletConnected, actionUrl: "/wallet" },
      accountAge: { days: accountAgeDays, passed: checks.accountAgeMet, actionUrl: null },
      phone: { verified: user.isPhoneVerified, passed: checks.phoneVerified, actionUrl: "/settings?tab=account" },
    };

    successResponse(res, { checks, allPassed, details });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[Qualification Error]", err.message);
    throw new ApiError(500, "Failed to check qualification status");
  }
});


const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) { throw new Error("GROQ_API_KEY environment variable is required"); }
const groq = new Groq({ apiKey: GROQ_API_KEY });

// Cache for active campaign drafts (in production use Redis/DB)
const campaignDrafts = new Map();

const CATEGORIES = [
  'Social Media', 'Content Creation', 'Development', 'Marketing',
  'Community', 'Music Promotion', 'Article / Blog Writing',
  'App / Website Review', 'Surveys', 'Lead Generation',
  'App Testing & Install', 'Other', 'Design', 'Data', 'Testing'
];

const PLATFORMS = {
  'Social Media': ['Twitter/X', 'Instagram', 'TikTok', 'Facebook', 'Telegram', 'Discord', 'YouTube', 'LinkedIn'],
  'Community': ['Telegram', 'Discord', 'Slack', 'Reddit'],
  'Marketing': ['Twitter/X', 'Instagram', 'TikTok', 'Facebook', 'Email', 'Influencer'],
  'Surveys': ['SurveyMonkey', 'Google Forms', 'Typeform', 'Custom'],
  'Testing': ['Website', 'Mobile App', 'Desktop App', 'API'],
};

const REWARD_RANGES = {
  'Twitter/X': { min: 30, recommended: 50, premium: 80, label: 'per follower/action' },
  'Instagram': { min: 40, recommended: 60, premium: 100, label: 'per action' },
  'Telegram': { min: 40, recommended: 60, premium: 100, label: 'per member' },
  'Discord': { min: 40, recommended: 60, premium: 100, label: 'per member' },
  'TikTok': { min: 50, recommended: 80, premium: 120, label: 'per action' },
  'YouTube': { min: 100, recommended: 200, premium: 500, label: 'per action' },
  'Website': { min: 300, recommended: 500, premium: 800, label: 'per test' },
  'Survey': { min: 50, recommended: 100, premium: 200, label: 'per response' },
  'Default': { min: 20, recommended: 50, premium: 100, label: 'per action' },
};

const SYSTEM_PROMPT = `You are OgaPay Campaign AI — a professional campaign builder for OgaPay, Nigeria's microtask marketplace.

Your job is to help users create campaigns by understanding their needs and generating complete campaign configurations.

ALWAYS respond with a valid JSON object at the end of your response wrapped in \`\`\`json ... \`\`\`.

The JSON must have this structure:
{
  "campaign": {
    "title": "string - compelling campaign title",
    "category": "string - one of: Social Media, Content Creation, Marketing, Community, Surveys, Testing, Design, Other",
    "platform": "string - the specific platform",
    "description": "string - detailed worker instructions (2-3 sentences)",
    "instructions": "string - step-by-step worker instructions with clear requirements",
    "submissionProof": "string - what proof workers must submit (screenshot, link, etc.)",
    "reward": "number - recommended reward per worker in NGN",
    "workerCount": "number - suggested number of workers",
    "budget": "number - total budget (reward * workers + 10% fee)",
    "completionTime": "string - estimated completion time like '24 hours', '3 days'",
    "difficulty": "string - one of: Easy, Medium, Hard",
    "qualityScore": "number - 0-100 quality score"
  },
  "rewardBreakdown": {
    "minimum": "number - minimum fair reward",
    "recommended": "number - recommended reward",
    "premium": "number - premium reward for faster completion"
  },
  "qualityChecks": [
    {"label": "Clear Instructions", "passed": true/false},
    {"label": "Fair Reward", "passed": true/false},
    {"label": "Easy Verification", "passed": true/false},
    {"label": "Good Completion Time", "passed": true/false}
  ],
  "warnings": ["array of warning strings if any"],
  "nextQuestions": ["array of follow-up questions if more info needed"]
}

Before the JSON, include a friendly professional message to the user explaining what you've created or what you need to know. Keep it concise (2-3 sentences max).

If you need more information, set nextQuestions and make the campaign fields partial.`;

// POST /api/v1/campaigns/generate
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, draftId } = req.body;
    if (!prompt || !prompt.trim()) {
      throw new ApiError(400, 'Please describe the campaign you want to create');
    }

    const userId = req.user.id;
    
    // Get existing draft if any
    const existingDraft = draftId ? campaignDrafts.get(`${userId}:${draftId}`) : null;
    
    const contextMsg = existingDraft 
      ? `\nExisting campaign draft: ${JSON.stringify(existingDraft)}\nUser's new request: ${prompt}`
      : `\nUser request: ${prompt}`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Generate a campaign for: ${contextMsg}\n\nCategories available: ${CATEGORIES.join(', ')}\n\nReward ranges in NGN. Be specific and realistic for Nigerian microtask market.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Extract JSON from response
    let jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    let campaignData = null;
    let message = responseText;
    
    if (jsonMatch) {
      try {
        campaignData = JSON.parse(jsonMatch[1]);
        message = responseText.replace(/```json[\s\S]*?```/, '').trim();
      } catch {}
    }

    // Save draft
    const newDraftId = draftId || `draft_${Date.now()}`;
    if (campaignData?.campaign) {
      campaignDrafts.set(`${userId}:${newDraftId}`, {
        ...campaignData.campaign,
        updatedAt: new Date().toISOString(),
      });
    }

    // Get reward ranges
    const platform = campaignData?.campaign?.platform || 'Default';
    const rewards = REWARD_RANGES[platform] || REWARD_RANGES['Default'];

    successResponse(res, {
      message: message || 'Here\'s your campaign plan!',
      campaign: campaignData?.campaign || null,
      rewardBreakdown: campaignData?.rewardBreakdown || rewards,
      qualityChecks: campaignData?.qualityChecks || [],
      warnings: campaignData?.warnings || [],
      nextQuestions: campaignData?.nextQuestions || [],
      draftId: newDraftId,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[Campaign AI Error]', err.message);
    throw new ApiError(500, 'Failed to generate campaign. Please try again.');
  }
});

// POST /api/v1/campaigns/rewrite
router.post('/rewrite', authenticate, async (req, res) => {
  try {
    const { draftId, style } = req.body;
    if (!draftId) throw new ApiError(400, 'No campaign draft specified');

    const userId = req.user.id;
    const draft = campaignDrafts.get(`${userId}:${draftId}`);
    if (!draft) throw new ApiError(404, 'Campaign draft not found');

    const styleInstructions = {
      'improve': 'Make the campaign description and instructions more compelling and detailed',
      'professional': 'Rewrite in a formal, professional tone suitable for business clients',
      'friendly': 'Rewrite in a warm, approachable tone',
      'shorter': 'Make the description concise and to the point',
      'simplify': 'Use simple language that anyone can understand',
      'regenerate': 'Create a fresh version with different wording but same campaign details',
    };

    const stylePrompt = styleInstructions[style] || 'Improve the campaign description';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Rewrite this campaign:\n${JSON.stringify(draft)}\n\nStyle: ${stylePrompt}\n\nReturn ONLY the updated JSON with the same structure.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    let jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    let campaignData = null;

    if (jsonMatch) {
      try {
        campaignData = JSON.parse(jsonMatch[1]);
      } catch {}
    }

    if (!campaignData?.campaign) {
      throw new ApiError(500, 'Failed to rewrite campaign');
    }

    // Update draft
    campaignDrafts.set(`${userId}:${draftId}`, { ...draft, ...campaignData.campaign });

    successResponse(res, {
      campaign: campaignData.campaign,
      message: `Campaign rewritten in ${style} style!`,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, 'Failed to rewrite campaign');
  }
});

// GET /api/v1/campaigns/qualification — Pre-qualification check before campaign creation
        walletAddress: true,
        phone: true,
        createdAt: true,
        kyc: { select: { status: true } },
      },
    });
    if (!user) throw new ApiError(404, "User not found");

    const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const kycStatus = user.kyc?.status || null;

    const checks = {
      kycVerified: kycStatus === "APPROVED",
      emailConfirmed: user.isEmailVerified,
      walletConnected: !!user.walletAddress,
      accountAgeMet: accountAgeDays >= 7,
      phoneVerified: user.isPhoneVerified,
    };

    const allPassed = Object.values(checks).every(Boolean);

    const details = {
      kyc: { status: kycStatus, passed: checks.kycVerified, actionUrl: "/settings?tab=kyc" },
      email: { verified: user.isEmailVerified, passed: checks.emailConfirmed, actionUrl: "/settings?tab=account" },
      wallet: { connected: !!user.walletAddress, passed: checks.walletConnected, actionUrl: "/wallet" },
      accountAge: { days: accountAgeDays, passed: checks.accountAgeMet, actionUrl: null },
      phone: { verified: user.isPhoneVerified, passed: checks.phoneVerified, actionUrl: "/settings?tab=account" },
    };

    successResponse(res, { checks, allPassed, details });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("[Qualification Error]", err.message);
    throw new ApiError(500, "Failed to check qualification status");
  }
});

module.exports = router;
