'use strict';
// Run: node scripts/seed-pay-tokens.js
// Seeds $PAY tokens to active users for vault testing

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const vaultService = require('../src/services/vault.service');

async function main() {
  console.log('🌱 Seeding $PAY tokens to active users...\n');

  // Get all users who have completed tasks or have wallets
  const users = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    select: { id: true, username: true, email: true },
    take: 20,
  });

  let seeded = 0;
  for (const user of users) {
    // Give each user a random amount of $PAY (100-5000)
    const amount = Math.floor(Math.random() * 4900) + 100;
    try {
      const balance = await vaultService.seedPayTokens(user.id, amount);
      console.log(`  ✅ ${user.username || user.email}: +${amount} $PAY (balance: ${balance})`);
      seeded++;
    } catch (err) {
      console.error(`  ❌ ${user.username || user.email}: ${err.message}`);
    }
  }

  // Check pool state
  const pool = await prisma.vaultPool.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log(`\n📊 Pool: ₦${Number(pool?.totalNgp || 0)}`);
  
  const holders = await prisma.wallet.count({ where: { currency: 'PAY', balance: { gt: 0 } } });
  console.log(`👥 $PAY holders: ${holders}`);
  console.log(`\n✅ Seeded ${seeded} users with $PAY tokens`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
