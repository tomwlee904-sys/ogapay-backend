const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const userId = '195f28e4-6aaa-46da-95d9-ad05e1411c6c';
  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId, currency: 'NGN' } },
    update: { balance: { increment: 500000 } },
    create: { userId, currency: 'NGN', balance: 500000, lockedBalance: 0, isActive: true },
  });
  console.log('New NGN balance:', wallet.balance);
  await prisma.$disconnect();
})();
