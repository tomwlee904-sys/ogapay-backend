-- Add VeryAI palm verification fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rank" TEXT NOT NULL DEFAULT 'NEWBIE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "very_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "very_unique_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_very_unique_id_key" ON "users"("very_unique_id");
