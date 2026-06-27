const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.post.updateMany({
    where: { status: 'DRAFT' },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  console.log(`Published ${result.count} posts`);

  const posts = await prisma.post.findMany({ where: { status: 'PUBLISHED' }, select: { title: true } });
  for (const p of posts) console.log(`  ${p.title}`);

  await prisma['$disconnect']();
}

main().catch(e => {
  console.error(e.message);
  prisma['$disconnect']();
});
