'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OgaPay database...');

  // ── Admin User ─────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@ogapay123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ogapay.io' },
    update: {},
    create: {
      email: 'admin@ogapay.io',
      passwordHash: adminHash,
      firstName: 'Oga',
      lastName: 'Admin',
      username: 'ogaadmin',
      role: 'ADMIN',
      referralCode: 'OGAADMIN1',
      isEmailVerified: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // ── Demo Worker ────────────────────────────────
  const workerHash = await bcrypt.hash('Worker@123', 12);
  const worker = await prisma.user.upsert({
    where: { email: 'chidi@example.com' },
    update: {},
    create: {
      email: 'chidi@example.com',
      passwordHash: workerHash,
      firstName: 'Chidi',
      lastName: 'Okonkwo',
      username: 'chidio',
      role: 'WORKER',
      referralCode: 'CHIDI001',
      isEmailVerified: true,
      wallets: {
        create: [
          { currency: 'NGN', balance: 5000 },
          { currency: 'USDC', balance: 10 },
          { currency: 'USDT', balance: 5 },
        ],
      },
      workerProfile: {
        create: {
          level: 'INTERMEDIATE',
          reputationScore: 72,
          tasksCompleted: 25,
          successRate: 96,
          avgRating: 4.6,
          totalRatings: 20,
          skills: ['Social Media', 'Data Entry', 'Content Writing'],
          bio: 'Fast and reliable worker from Lagos.',
        },
      },
      kyc: { create: { status: 'APPROVED', verifiedAt: new Date() } },
    },
  });
  console.log('✅ Demo worker created:', worker.email);

  // ── Demo Poster ────────────────────────────────
  const posterHash = await bcrypt.hash('Poster@123', 12);
  const poster = await prisma.user.upsert({
    where: { email: 'amaka@startup.ng' },
    update: {},
    create: {
      email: 'amaka@startup.ng',
      passwordHash: posterHash,
      firstName: 'Amaka',
      lastName: 'Eze',
      username: 'amaka_builds',
      role: 'POSTER',
      referralCode: 'AMAKA001',
      isEmailVerified: true,
      wallets: {
        create: [
          { currency: 'NGN', balance: 50000 },
          { currency: 'USDC', balance: 200 },
          { currency: 'USDT', balance: 100 },
        ],
      },
      posterProfile: {
        create: {
          companyName: 'Amaka Builds Ltd',
          website: 'https://amaka.builds',
          isVerified: true,
        },
      },
      kyc: { create: { status: 'APPROVED', verifiedAt: new Date() } },
    },
  });
  console.log('✅ Demo poster created:', poster.email);

  // ── Sample Store Items ─────────────────────────
  await prisma.storeItem.createMany({
    skipDuplicates: true,
    data: [
      { name: 'OgaPay Premium Badge', description: 'Show your premium status on your profile', price: 2000, currency: 'NGN', category: 'BADGE', imageUrl: 'https://ogapay.io/assets/badges/premium.png' },
      { name: 'Task Boost (24h)', description: 'Boost your task to the top of listings for 24 hours', price: 1500, currency: 'NGN', category: 'BOOST', stock: 100 },
      { name: 'Verified Worker Frame', description: 'Exclusive profile frame for top workers', price: 500, currency: 'NGN', category: 'COSMETIC' },
      { name: 'Priority Support (30 days)', description: 'Skip the queue with priority support access', price: 5000, currency: 'NGN', category: 'SERVICE' },
    ],
  });
  console.log('✅ Store items seeded');

  // ── Sample Open Task ───────────────────────────
  const posterRecord = await prisma.user.findUnique({ where: { email: 'amaka@startup.ng' } });
  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        posterId: posterRecord.id,
        title: 'Follow our Instagram and leave a meaningful comment',
        description: 'We need real Nigerian users to follow our Instagram page @AmakaBuildsTech and leave a thoughtful comment on our latest post. Comment must be at least 20 words.',
        category: 'SOCIAL_MEDIA',
        reward: 200,
        currency: 'NGN',
        maxWorkers: 50,
        status: 'OPEN',
        escrowed: true,
        platformFee: 1000,
        instructions: '1. Follow @AmakaBuildsTech\n2. Like the latest post\n3. Leave a 20+ word comment\n4. Screenshot proof required',
        proofRequired: 'Screenshot of comment',
        tags: ['instagram', 'social media', 'follow'],
        estimatedTime: 5,
      },
      {
        posterId: posterRecord.id,
        title: 'Fill out our 5-minute product survey',
        description: 'Complete our product feedback survey about fintech apps in Nigeria. Honest answers required. Takes about 5 minutes.',
        category: 'SURVEY',
        reward: 150,
        currency: 'NGN',
        maxWorkers: 200,
        status: 'OPEN',
        escrowed: true,
        platformFee: 3000,
        instructions: 'Click the survey link and complete all questions honestly.',
        proofRequired: 'Screenshot of completion page',
        tags: ['survey', 'fintech', 'nigeria'],
        estimatedTime: 5,
      },
    ],
  });
  console.log('✅ Sample tasks seeded');

  console.log('\n🎉 Seed complete!');
  console.log('   Admin: admin@ogapay.io / Admin@ogapay123');
  console.log('   Worker: chidi@example.com / Worker@123');
  console.log('   Poster: amaka@startup.ng / Poster@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
