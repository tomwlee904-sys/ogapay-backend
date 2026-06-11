#!/bin/bash
set -e

echo "📦 Installing dependencies..."
npm install --omit=dev

echo "🗃️  Fixing database constraints..."
# Drop the problematic FK constraint on job_listings that references auth.users
# This is needed because Prisma's db push can't handle cross-schema FKs
npx prisma db execute --stdin <<< "ALTER TABLE IF EXISTS public.job_listings DROP CONSTRAINT IF EXISTS job_listings_employer_id_fkey;" 2>/dev/null || echo "ℹ️  No FK constraint to drop or table missing"

echo "🗃️  Pushing Prisma schema..."
npx prisma db push --accept-data-loss

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🌱 Running seed..."
node prisma/seed.js

echo "✅ Build complete!"
