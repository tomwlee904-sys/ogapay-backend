#!/bin/bash
set -e

echo "🔧 Pre-build: Dropping job_listings cross-schema FK..."
# Use node with pg (available as Prisma dependency) to drop the FK directly
# This avoids Prisma entirely since prisma db push can't handle cross-schema refs
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  console.log('  Connected to DB');
  return client.query(\"SELECT 1 FROM information_schema.tables WHERE table_name = 'job_listings'\");
}).then((res) => {
  if (res.rows.length === 0) {
    console.log('  job_listings table does not exist yet — nothing to fix');
    return client.end();
  }
  return client.query(\"ALTER TABLE IF EXISTS public.job_listings DROP CONSTRAINT IF EXISTS job_listings_employer_id_fkey CASCADE\")
    .then(() => {
      console.log('  ✅ Dropped job_listings_employer_id_fkey constraint');
      return client.end();
    });
}).catch((err) => {
  console.log('  ⚠️  Could not drop constraint: ' + err.message);
  client.end().then(() => process.exit(0));  // Non-fatal
});
" 2>&1

echo "✅ Pre-build complete"
