const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.community.updateMany({ data: { isActive: true } });
  console.log('Updated ' + r.count + ' communities to isActive: true');
}
main().catch(e => console.error('Failed:', e.message)).finally(() => prisma.$disconnect());
