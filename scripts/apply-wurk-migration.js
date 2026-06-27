process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.dxotaqwfofmnfzlgzfnz:Folashade1234_@aws-0-eu-west-3.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  console.log('Connected');
  await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verified_creator" BOOLEAN NOT NULL DEFAULT false');
  console.log('  added verified_creator');
  await client.query('ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "more_about" TEXT');
  console.log('  added more_about');
  await client.query('ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "challenges_participated" INTEGER NOT NULL DEFAULT 0');
  console.log('  added challenges_participated');
  await client.query('ALTER TABLE "worker_profiles" ADD COLUMN IF NOT EXISTS "challenges_won" INTEGER NOT NULL DEFAULT 0');
  console.log('  added challenges_won');
  console.log('Migration applied successfully');
  await client.end();
}
run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
