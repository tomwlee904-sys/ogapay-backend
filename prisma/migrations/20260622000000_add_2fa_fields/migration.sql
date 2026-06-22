-- Add 2FA fields to users table
ALTER TABLE "users" ADD COLUMN "is_two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "two_factor_secret" TEXT;
