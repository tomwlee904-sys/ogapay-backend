const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const published = await prisma.post.count({ where: { status: 'PUBLISHED' } });
  const total = await prisma.post.count();
  console.log('Published posts:', published);
  console.log('Total posts:', total);

  const posts = await prisma.post.findMany({ select: { title: true, slug: true, status: true } });
  for (const p of posts) {
    console.log(`  ${p.status}: ${p.title} (${p.slug})`);
  }

  await prisma['$disconnect']();
}

main().catch(e => {
  console.error(e.message);
  prisma['$disconnect']();
});
