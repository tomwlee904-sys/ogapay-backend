require('dotenv').config();
// Use DIRECT_URL for DDL (bypasses PgBouncer)
process.env.DATABASE_URL = process.env.DIRECT_URL;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const exists = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'cover_url'
  `);
  if (exists.length > 0) {
    console.log('Column cover_url already exists');
    return;
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN "cover_url" TEXT;`);
  console.log('Column cover_url added');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
