const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.update({
  where: { email: 'kermitkwif@gmail.com' },
  data: { role: 'ADMIN' }
}).then(u => {
  console.log('Promoted:', u.email, '->', u.role);
  return prisma['$disconnect']();
}).catch(e => {
  console.error(e.message);
  return prisma['$disconnect']();
});
