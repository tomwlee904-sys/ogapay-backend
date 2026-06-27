-- Add email verification and password reset fields
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "email_verification_token_expiry" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS "password_reset_token_expiry" TIMESTAMPTZ;
