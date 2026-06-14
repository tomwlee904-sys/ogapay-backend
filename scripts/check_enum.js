const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const r = await p.$queryRawUnsafe('SELECT enum_range(NULL::"TaskSubmissionStatus")');
    console.log(JSON.stringify(r));
  } catch (e) {
    console.error('Error:', e.message);
  }
  await p.$disconnect();
}

main();
