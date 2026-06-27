require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.community.findMany({
  include: {
    _count: { select: { members: true } },
    owner: { select: { email: true, username: true } }
  }
}).then(r => {
  console.log('Total communities:', r.length);
  r.forEach(c => console.log(`  ${c.name} (owner: ${c.owner.username}) members: ${c._count.members}`));
  return p.$disconnect();
}).catch(e => {
  console.log('ERROR:', e.message?.slice(0, 200));
  return p.$disconnect();
});
