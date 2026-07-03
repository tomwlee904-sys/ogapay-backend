// Direct SQL migration: add minRank and workerRequirement columns if missing
const { Client } = require('pg');

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('  Connected to DB');

  // Check if min_rank column exists
  const check = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'task' AND column_name = 'min_rank'
  `);

  if (check.rows.length === 0) {
    console.log('  Adding min_rank column...');
    await client.query(`ALTER TABLE public.task ADD COLUMN IF NOT EXISTS min_rank INTEGER DEFAULT 0`);
    console.log('  ✅ min_rank column added');
  } else {
    console.log('  min_rank column already exists');
  }

  // Check if worker_requirement column exists
  const check2 = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'task' AND column_name = 'worker_requirement'
  `);

  if (check2.rows.length === 0) {
    console.log('  Adding worker_requirement column...');
    await client.query(`ALTER TABLE public.task ADD COLUMN IF NOT EXISTS worker_requirement TEXT`);
    console.log('  ✅ worker_requirement column added');
  } else {
    console.log('  worker_requirement column already exists');
  }

  await client.end();
  console.log('  ✅ Migration complete');
}

migrate().catch(err => {
  console.error('  ⚠️ Migration error:', err.message);
  process.exit(0); // Non-fatal
});
