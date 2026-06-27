'use strict'
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function run() {
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discord" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" TEXT')
  await prisma.$executeRawUnsafe("ALTER TYPE \"TaskSubmissionStatus\" ADD VALUE IF NOT EXISTS 'SUBMITTED'")

  // Twitter OAuth fields
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_oauth_token" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_oauth_refresh_token" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_oauth_token_expiry" TIMESTAMPTZ')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_oauth_user_id" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_oauth_handle" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_oauth_connected" BOOLEAN NOT NULL DEFAULT false')

  // LinkedIn OAuth fields
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_oauth_token" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_oauth_refresh_token" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_oauth_token_expiry" TIMESTAMPTZ')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_oauth_user_id" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_oauth_handle" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_oauth_connected" BOOLEAN NOT NULL DEFAULT false')

  // GitHub OAuth fields
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_oauth_token" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_oauth_user_id" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_oauth_handle" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_oauth_connected" BOOLEAN NOT NULL DEFAULT false')

  // Email verification fields
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT')
  await prisma.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_expiry" TIMESTAMPTZ')

  console.log('Migration applied successfully')
  await prisma.$disconnect()
}

run().catch(e => { console.error(e.message); process.exit(1) })
