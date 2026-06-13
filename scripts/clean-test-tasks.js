'use strict';
// Deletes all E2E agent test tasks and their submissions
// Run: node scripts/clean-test-tasks.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const where = {
    OR: [
      { title: { startsWith: 'Agent Test Task' } },
      { description: { contains: 'Automated test task for E2E agent' } },
    ],
  };

  const count = await prisma.task.count({ where });
  if (count === 0) {
    console.log('No test tasks found.');
    return;
  }

  console.log(`Found ${count} test tasks. Deleting...`);

  // Delete submissions first, then tasks
  const tasks = await prisma.task.findMany({ where, select: { id: true, title: true } });
  for (const t of tasks) {
    await prisma.taskSubmission.deleteMany({ where: { taskId: t.id } });
    await prisma.task.delete({ where: { id: t.id } });
    console.log(`  Deleted: ${t.id} — ${t.title}`);
  }

  console.log(`Done. ${count} test tasks removed.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
