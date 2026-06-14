require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const updated = await prisma.community.updateMany({
    where: { isActive: false },
    data: { isActive: true },
  })
  console.log(`Updated ${updated.count} communities to isActive=true`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
