import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const r = await p.$queryRawUnsafe("SELECT enum_range(NULL::\"TaskSubmissionStatus\")");
  console.log(JSON.stringify(r));
} catch(e) {
  console.error('Err:', e.message);
}
await p.$disconnect();
