const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const posterId = '50953ab5-c734-402d-96db-f14247d0596f';
  let wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: posterId, currency: 'NGN' } }
  });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: posterId, currency: 'NGN', balance: 1000000, lockedBalance: 0 }
    });
    console.log('Created wallet:', wallet.id);
  } else {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: 1000000 }
    });
    console.log('Updated wallet:', wallet.id, 'balance: 1000000');
  }
  console.log('Done');
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
