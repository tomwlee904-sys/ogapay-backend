'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wallets = await prisma.wallet.findMany({
    include: { user: { select: { email: true, username: true, role: true } } },
    orderBy: { balance: 'asc' }
  });
  console.log('=== All Wallets ===');
  for (const w of wallets) {
    console.log(`${w.user.email || w.user.username} | ${w.currency} | balance: ${w.balance.toString()} | locked: ${w.lockedBalance.toString()} | ${w.user.role}`);
  }
  const neg = wallets.filter(w => Number(w.balance) < 0);
  console.log('\n=== Negative balances ===');
  for (const w of neg) {
    console.log(`${w.user.email || w.user.username} | ${w.currency} | ${w.balance.toString()}`);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
