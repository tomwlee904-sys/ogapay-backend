const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'amaka@startup.ng';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  console.log('Found:', user.id, user.email, '2FA enabled:', user.isTwoFactorEnabled);
  await prisma.user.update({
    where: { email },
    data: { isTwoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  });
  try { await prisma.twoFactorChallenge.deleteMany({ where: { userId: user.id } }) } catch {}
  console.log('2FA disabled for', email);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
