const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const workerId = '5eae2c5d-0121-4082-accd-0d9a766186ac';
  let wp = await prisma.workerProfile.findUnique({ where: { userId: workerId } });
  if (!wp) {
    wp = await prisma.workerProfile.create({
      data: { userId: workerId, categories: ['SOCIAL_MEDIA'], isAvailable: true }
    });
    console.log('Created worker profile');
  } else {
    await prisma.workerProfile.update({
      where: { userId: workerId },
      data: { categories: ['SOCIAL_MEDIA'], isAvailable: true }
    });
    console.log('Updated worker profile');
  }
  console.log('Done');
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
