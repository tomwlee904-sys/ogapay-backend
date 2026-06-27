-- Add social link fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discord" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" TEXT;
