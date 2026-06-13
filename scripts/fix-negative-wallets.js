'use strict';
// Reset negative wallet balances to 0 and fund test accounts
// Run: node scripts/fix-negative-wallets.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Fix all negative balances
  const negWallets = await prisma.wallet.findMany({
    where: { balance: { lt: 0 } },
    include: { user: { select: { email: true, username: true } } },
  });

  for (const w of negWallets) {
    console.log(`Resetting ${w.user.email || w.user.username} ${w.currency}: ${w.balance.toString()} → 0`);
    await prisma.wallet.update({
      where: { id: w.id },
      data: { balance: 0, lockedBalance: 0 },
    });
  }

  // 2. Fund amaka@startup.ng with test NGN
  const amaka = await prisma.user.findUnique({ where: { email: 'amaka@startup.ng' } });
  if (amaka) {
    const existing = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: amaka.id, currency: 'NGN' } },
    });
    if (existing) {
      await prisma.wallet.update({
        where: { id: existing.id },
        data: { balance: 500000, lockedBalance: 0 },
      });
      console.log(`Funded amaka@startup.ng NGN wallet: 500,000`);
    } else {
      await prisma.wallet.create({
        data: { userId: amaka.id, currency: 'NGN', balance: 500000, isActive: true },
      });
      console.log(`Created + funded amaka@startup.ng NGN wallet: 500,000`);
    }
  }

  // 3. Fund poster@ogapay.io with test NGN
  const poster = await prisma.user.findUnique({ where: { email: 'poster@ogapay.io' } });
  if (poster) {
    const existing = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: poster.id, currency: 'NGN' } },
    });
    if (existing) {
      await prisma.wallet.update({
        where: { id: existing.id },
        data: { balance: 500000, lockedBalance: 0 },
      });
    } else {
      await prisma.wallet.create({
        data: { userId: poster.id, currency: 'NGN', balance: 500000, isActive: true },
      });
    }
    console.log(`Funded poster@ogapay.io NGN wallet: 500,000`);
  }

  // 4. Fund beta testers (beta1-5@ogapay.io)
  for (let i = 1; i <= 5; i++) {
    const email = `beta${i}@ogapay.io`;
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) continue;
    const existing = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: u.id, currency: 'NGN' } },
    });
    if (existing) {
      await prisma.wallet.update({
        where: { id: existing.id },
        data: { balance: 50000, lockedBalance: 0 },
      });
    } else {
      await prisma.wallet.create({
        data: { userId: u.id, currency: 'NGN', balance: 50000, isActive: true },
      });
    }
    console.log(`Funded ${email} NGN wallet: 50,000`);
  }

  console.log('\nDone. All negative balances reset, test accounts funded.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
