-- Add referral cap and signup bonus fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_milestone_reached_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_bonus_paid" BOOLEAN NOT NULL DEFAULT false;

-- Add SIGNUP_BONUS to TransactionType enum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SIGNUP_BONUS';
