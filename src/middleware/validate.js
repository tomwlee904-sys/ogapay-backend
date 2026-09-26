'use strict';

const { z } = require('zod');
const { ApiError } = require('../utils/apiResponse');

// Middleware factory: validate req.body against a Zod schema
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw ApiError.badRequest('Validation failed', errors);
  }
  req.body = result.data;
  next();
};

// ── Schemas ────────────────────────────────────

const registerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores'),
  role: z.enum(['WORKER', 'POSTER']).optional().default('WORKER'),
  referralCode: z.string().optional(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const createTaskSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(10000),
  category: z.enum([
    'SOCIAL_MEDIA', 'DATA_ENTRY', 'CONTENT_WRITING', 'APP_TESTING',
    'SURVEY', 'DESIGN', 'TRANSLATION', 'WEB_RESEARCH', 'VIDEO_REVIEW', 'OTHER',
  ]),
  reward: z.number().positive(),
  currency: z.enum(['NGN', 'USDC', 'USDT', 'SOL', 'ETH', 'MATIC']).default('NGN'),
  maxWorkers: z.number().int().min(1).max(1000).default(1),
  deadline: z.string().datetime().optional(),
  instructions: z.string().optional(),
  proofRequired: z.string().optional(),
  tags: z.array(z.string()).max(5).optional(),
  estimatedTime: z.number().int().min(1).max(10080).optional(),
  // Worker level needed: 1 Beginner … 5 Legend (higher values count as Legend)
  minRank: z.number().int().min(0).max(100).optional(),
  // KYC and HUMAN are enforced when applying; other text is shown but not checked
  workerRequirement: z.string().max(200).optional(),
  minSorsaScore: z.number().int().min(0).max(100).optional(),
  requiresWallet: z.boolean().optional(),
  requiresX: z.boolean().optional(),
  trackingCode: z.string().trim().max(64).optional(),
  attachments: z.array(z.string().url().max(2048)).max(10).optional(),
}).superRefine((data, ctx) => {
  if (data.currency === 'NGN' && data.reward < 50) {
    ctx.addIssue({ code: 'custom', message: 'Minimum reward is 50 NGN', path: ['reward'] });
  }
});

// PATCH /users/me: only these fields, with sane limits (unknown keys, e.g. role, are dropped)
const optText = (max) => z.string().trim().max(max).optional().nullable();
const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,30}$/, 'Username must be 3-30 letters, numbers or _').optional(),
  phone: optText(20),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable(),
  coverUrl: z.string().trim().url().max(2048).optional().nullable(),
  twitter: optText(100),
  telegram: optText(100),
  discord: optText(100),
  website: optText(200).refine((v) => !v || /^https?:\/\//i.test(v), 'Website must start with http:// or https://'),
  preferences: z.record(z.any()).optional(),
  isPublic: z.boolean().optional(),
  bio: optText(1000),
  skills: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  categories: z.array(z.enum([
    'SOCIAL_MEDIA', 'DATA_ENTRY', 'CONTENT_WRITING', 'APP_TESTING',
    'SURVEY', 'DESIGN', 'TRANSLATION', 'WEB_RESEARCH', 'VIDEO_REVIEW', 'OTHER',
  ])).max(10).optional(),
  isAvailable: z.boolean().optional(),
  companyName: optText(100),
});

// Store products (seller-created). Price must be positive: a negative price used to
// move money from seller to buyer. Only these fields are kept (no free-form metadata).
const storeProductBase = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  price: z.coerce.number().positive().max(100000000),
  currency: z.enum(['NGN', 'USDC', 'SOL']),
  category: z.string().trim().min(2).max(60),
  subcategory: z.string().trim().max(60).optional().nullable(),
  imageUrl: z.string().trim().url().max(2048).refine((u) => /^https:\/\//i.test(u), 'Image must be an https link').optional().nullable(),
  stock: z.coerce.number().int().min(0).max(1000000).optional().nullable(),
  delivery: z.string().trim().max(30).optional().nullable(),
  revisions: z.coerce.number().int().min(0).max(50).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  status: z.enum(['ACTIVE', 'DRAFT']).optional(),
});
const STORE_MIN_NGN = 100;
const storeProductSchema = storeProductBase.extend({ currency: z.enum(['NGN', 'USDC', 'SOL']).default('NGN') })
  .superRefine((d, ctx) => {
    if (d.currency === 'NGN' && d.price < STORE_MIN_NGN) ctx.addIssue({ code: 'custom', path: ['price'], message: `Minimum price is ₦${STORE_MIN_NGN}` });
  });
// Edits: any subset (the ₦ minimum is checked in the route against the saved currency)
const storeProductUpdateSchema = storeProductBase.partial();

// Private direct hire from a profile (NGN, one worker)
const hireSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  brief: z.string().trim().min(20).max(10000),
  budget: z.number().min(100),                                  // NGN, worker receives this
  deadline: z.string().datetime().optional(),
  attachments: z.array(z.string().url().max(2048)).max(5).optional(),
});

const httpUrl = z.string().trim().url().max(2048).refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) link');
const portfolioItemSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  url: httpUrl.optional().nullable(),
  imageUrl: httpUrl.optional().nullable(),
  position: z.number().int().min(0).max(1000).optional(),
});

const submitTaskSchema = z.object({
  proof: z.string().optional(),
  workerNotes: z.string().max(1000).optional(),
  attachments: z.array(z.string()).max(5).optional(),
});

const reviewSubmissionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  posterNotes: z.string().max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(500).optional(),
});

const depositSchema = z.object({
  amount: z.number().positive().min(100), // Min ₦100
  currency: z.enum(['NGN', 'USDC', 'USDT', 'ETH', 'MATIC']).default('NGN'),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'CRYPTO']).default('PAYSTACK'),
  callbackUrl: z.string().url().optional(),
});

// Send money to another OgaPay user (internal ledger)
const sendSchema = z.object({
  recipient: z.string().trim().min(1).max(254),   // username or email
  amount: z.number().positive().min(100),          // Min NGN 100
  currency: z.enum(['NGN']).default('NGN'),        // NGN only for now
  note: z.string().trim().max(140).optional(),
});

const withdrawSchema = z.object({
  amount: z.number().positive().min(100),
  currency: z.enum(['NGN', 'USDC', 'USDT', 'ETH', 'MATIC', 'SOL']).default('NGN'),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  walletAddress: z.string().optional(),
}).refine(data => {
  if (data.currency === 'NGN' && !data.accountNumber) {
    return false;
  }
  return true;
}, { message: 'Account number is required for NGN withdrawals' });

const kycSubmitSchema = z.object({
  idType: z.enum(['NIN', 'BVN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD']),
  idNumber: z.string().min(6).max(30),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  createTaskSchema,
  hireSchema,
  storeProductSchema,
  storeProductUpdateSchema,
  updateProfileSchema,
  portfolioItemSchema,
  submitTaskSchema,
  reviewSubmissionSchema,
  depositSchema,
  withdrawSchema,
  sendSchema,
  kycSubmitSchema,
};
