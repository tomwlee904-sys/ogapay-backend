-- Add WURK-inspired profile fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verified_creator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "more_about" TEXT;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "challenges_participated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "challenges_won" INTEGER NOT NULL DEFAULT 0;
