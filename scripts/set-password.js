const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = 'Admin123!';
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email: 'kermitkwif@gmail.com' },
    data: { passwordHash: hash },
  });
  console.log('Password set for:', user.email, 'New password:', password);
  await prisma['$disconnect']();
}

main().catch(e => {
  console.error(e.message);
  prisma['$disconnect']();
  process.exit(1);
});
