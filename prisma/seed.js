'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding OgaPay database...');

  // ── Admin ──────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@ogapay123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ogapay.io' },
    update: {},
    create: {
      email: 'admin@ogapay.io',
      passwordHash: adminHash,
      firstName: 'Oga', lastName: 'Admin', username: 'ogaadmin',
      role: 'ADMIN', referralCode: 'OGAADMIN1', isEmailVerified: true,
    },
  });
  console.log('Admin:', admin.email);

  // ── Demo Worker (Chidi) ────────────────────────────────
  const w1Hash = await bcrypt.hash('Worker@123', 12);
  const worker = await prisma.user.upsert({
    where: { email: 'chidi@example.com' },
    update: {},
    create: {
      email: 'chidi@example.com', passwordHash: w1Hash,
      firstName: 'Chidi', lastName: 'Okonkwo', username: 'chidio',
      role: 'WORKER', referralCode: 'CHIDI001', isEmailVerified: true,
      pushNotifications: true, currency: 'NGN',
      wallets: { create: [
        { currency: 'NGN', balance: 5000 },
        { currency: 'USDC', balance: 10 },
        { currency: 'USDT', balance: 5 },
      ]},
      workerProfile: {
        create: {
          level: 'INTERMEDIATE', reputationScore: 72, tasksCompleted: 25,
          successRate: 96, avgRating: 4.6, totalRatings: 20,
          skills: ['Social Media', 'Data Entry', 'Content Writing'],
          bio: 'Fast and reliable worker from Lagos. Available for social media tasks and data entry.',
        },
      },
      kyc: { create: { status: 'APPROVED', verifiedAt: new Date() } },
    },
  });
  console.log('Worker:', worker.email);

  // ── Beta Testers ───────────────────────────────────────
  const betaUsers = [
    { email: 'zainab@example.com', firstName: 'Zainab', lastName: 'Abdullahi', username: 'zainab_ah', skills: ['Content Writing', 'Translation', 'Web Research'], bio: 'Content writer and translator based in Kano. Fluent in Hausa and English.', level: 'BEGINNER', ngn: 2000 },
    { email: 'tunde@example.com', firstName: 'Tunde', lastName: 'Balogun', username: 'tunde_b', skills: ['Graphic Design', 'Video Editing', 'Social Media'], bio: 'Creative designer from Ibadan. I make thumbnails, edit videos, and manage social pages.', level: 'INTERMEDIATE', ngn: 3500 },
    { email: 'grace@example.com', firstName: 'Grace', lastName: 'Emenike', username: 'grace_e', skills: ['Data Entry', 'Survey', 'Web Research'], bio: 'Detail-oriented data entry specialist from Enugu. Fast typer, accurate results.', level: 'BEGINNER', ngn: 1500 },
    { email: 'emeka@example.com', firstName: 'Emeka', lastName: 'Okafor', username: 'emeka_o', skills: ['Social Media', 'Content Writing', 'App Testing'], bio: 'Social media manager and app tester from Port Harcourt. Love finding bugs!', level: 'ADVANCED', ngn: 7800 },
  ];

  const betaRecords = [];
  for (const b of betaUsers) {
    const hash = await bcrypt.hash('Beta@123', 12);
    const user = await prisma.user.upsert({
      where: { email: b.email },
      update: {},
      create: {
        email: b.email, passwordHash: hash,
        firstName: b.firstName, lastName: b.lastName, username: b.username,
        role: 'WORKER', referralCode: b.username.toUpperCase(), isEmailVerified: true,
        pushNotifications: true, currency: 'NGN',
        wallets: { create: [
          { currency: 'NGN', balance: b.ngn },
          { currency: 'USDC', balance: 5 },
        ]},
        workerProfile: {
          create: {
            level: b.level, reputationScore: 50, tasksCompleted: 0,
            successRate: 100, avgRating: 0, totalRatings: 0,
            skills: b.skills, bio: b.bio,
          },
        },
      },
    });
    betaRecords.push(user);
    console.log('Beta:', user.email);
  }

  // ── Demo Poster (Amaka) ────────────────────────────────
  const posterHash = await bcrypt.hash('Poster@123', 12);
  const poster = await prisma.user.upsert({
    where: { email: 'amaka@startup.ng' },
    update: {},
    create: {
      email: 'amaka@startup.ng', passwordHash: posterHash,
      firstName: 'Amaka', lastName: 'Eze', username: 'amaka_builds',
      role: 'POSTER', referralCode: 'AMAKA001', isEmailVerified: true,
      pushNotifications: true, currency: 'NGN',
      wallets: { create: [
        { currency: 'NGN', balance: 50000 },
        { currency: 'USDC', balance: 200 },
        { currency: 'USDT', balance: 100 },
      ]},
      posterProfile: {
        create: { companyName: 'Amaka Builds Ltd', website: 'https://amaka.builds', isVerified: true },
      },
      kyc: { create: { status: 'APPROVED', verifiedAt: new Date() } },
    },
  });
  console.log('Poster:', poster.email);

  // ── Tasks ──────────────────────────────────────────────
  const existingTasks = await prisma.task.count();
  if (existingTasks === 0) {
    const tasks = [
      { title: 'Follow @AmakaBuildsTech on Instagram & comment', desc: 'Follow our Instagram page and leave a thoughtful 20+ word comment on the latest post.', cat: 'SOCIAL_MEDIA', reward: 200, max: 50, tags: ['instagram', 'social media', 'follow'], est: 5, instr: '1. Follow @AmakaBuildsTech\n2. Like the latest post\n3. Leave a 20+ word comment\n4. Screenshot proof', proof: 'Screenshot of your comment' },
      { title: 'Product feedback survey (5 min)', desc: 'Complete a short survey about fintech apps in Nigeria. Honest answers only.', cat: 'SURVEY', reward: 150, max: 200, tags: ['survey', 'fintech', 'nigeria'], est: 5, instr: 'Click the link and answer all questions honestly.', proof: 'Screenshot of completion page' },
      { title: 'Retweet & quote our launch post on X', desc: 'Retweet our pinned launch post and add a 1-sentence quote about what you love about OgaPay.', cat: 'SOCIAL_MEDIA', reward: 100, max: 100, tags: ['twitter', 'x', 'retweet', 'social media'], est: 2, instr: '1. Go to x.com/ogapay\n2. Retweet the pinned post\n3. Quote with your thoughts\n4. Screenshot proof', proof: 'Screenshot of your quote retweet' },
      { title: 'Join our Telegram group', desc: 'Join the OgaPay Telegram community and say hello in the introductions channel.', cat: 'SOCIAL_MEDIA', reward: 100, max: 100, tags: ['telegram', 'community'], est: 2, instr: '1. Join t.me/ogapay\n2. Send a hello message in #introductions\n3. Screenshot proof', proof: 'Screenshot showing you in the group' },
      { title: 'Transcribe this 2-min audio clip (English)', desc: 'Listen to a 2-minute English audio clip and provide an accurate transcript.', cat: 'TRANSLATION', reward: 300, max: 20, tags: ['transcription', 'english', 'audio'], est: 10, instr: 'Listen carefully and type the exact words you hear. Minimum 95% accuracy required.', proof: 'Paste your transcript in the submission' },
      { title: 'Find 5 verified Lagos restaurants on Google Maps', desc: 'Search Google Maps for 5 restaurants in Lagos with valid phone numbers and at least 50 reviews.', cat: 'WEB_RESEARCH', reward: 250, max: 30, tags: ['research', 'google maps', 'lagos'], est: 15, instr: '1. Search Google Maps\n2. Find restaurants with 50+ reviews\n3. Copy name, address, phone\n4. Submit as text', proof: 'List of 5 restaurants with details' },
      { title: 'Design a social media banner for OgaPay', desc: 'Create a 1200x600px banner for OgaPay. Must include logo and "Earn by completing tasks" text.', cat: 'DESIGN', reward: 500, max: 10, tags: ['design', 'banner', 'canva'], est: 30, instr: 'Use Canva or any design tool. Export as PNG. Must be original work.', proof: 'Upload your PNG design' },
      { title: 'Watch & review our 3-min explainer video', desc: 'Watch the OgaPay explainer video on YouTube and leave a detailed 50+ word review.', cat: 'VIDEO_REVIEW', reward: 200, max: 40, tags: ['video', 'review', 'youtube'], est: 8, instr: '1. Watch the video\n2. Leave a comment (50+ words)\n3. Like the video\n4. Screenshot proof', proof: 'Screenshot of your YouTube comment' },
      { title: 'Enter 50 business contacts into spreadsheet', desc: 'Find 50 Nigerian businesses in your state and enter: name, address, phone, email into our Google Sheet.', cat: 'DATA_ENTRY', reward: 400, max: 15, tags: ['data entry', 'spreadsheet', 'business'], est: 45, instr: 'Use Google or business directories. No duplicates. Verify phone numbers.', proof: 'Link to completed sheet or screenshot' },
      { title: 'Translate this landing page to Yoruba', desc: 'Translate our 200-word landing page from English to Yoruba. Natural translation, not literal.', cat: 'TRANSLATION', reward: 350, max: 10, tags: ['translation', 'yoruba', 'content'], est: 20, instr: 'Translate naturally. Keep the marketing tone. Proofread before submitting.', proof: 'Paste your Yoruba translation' },
      { title: 'Test our mobile signup flow & report bugs', desc: 'Sign up on OgaPay mobile and go through onboarding. Report any issues or bugs you find.', cat: 'APP_TESTING', reward: 300, max: 20, tags: ['testing', 'mobile', 'bugs', 'qa'], est: 15, instr: '1. Go to ogapay.app on your phone\n2. Complete signup + onboarding\n3. Note any issues\n4. Submit feedback', proof: 'Describe what you tested and any bugs found' },
      { title: 'Write a 300-word blog intro about gig economy in Nigeria', desc: 'Write an engaging 300-word blog introduction about the gig economy in Nigeria for our blog.', cat: 'CONTENT_WRITING', reward: 350, max: 10, tags: ['writing', 'blog', 'gig economy', 'nigeria'], est: 25, instr: 'Original content only. Write in an engaging, professional tone. Must be 250-350 words.', proof: 'Paste your blog intro text' },
    ];

    for (const t of tasks) {
      await prisma.task.create({
        data: {
          posterId: poster.id,
          title: t.title, description: t.desc, category: t.cat,
          reward: t.reward, currency: 'NGN', maxWorkers: t.max,
          status: 'OPEN', escrowed: true, platformFee: Math.round(t.reward * t.max * 0.1),
          instructions: t.instr, proofRequired: t.proof, tags: t.tags,
          estimatedTime: t.est,
        },
      });
    }
    console.log('12 tasks seeded');
  } else {
    console.log('Tasks already exist, skipping');
  }

  // ── Store Items ─────────────────────────────────────────
  const existingItems = await prisma.storeItem.count();
  if (existingItems === 0) {
    await prisma.storeItem.createMany({
      data: [
        { name: 'OgaPay Premium Badge', description: 'Show your premium status on your profile with an exclusive gold badge.', price: 2000, currency: 'NGN', category: 'BADGE', stock: 50 },
        { name: 'Task Boost (24h)', description: 'Boost your task to the top of all listings for 24 hours. Get more applicants.', price: 1500, currency: 'NGN', category: 'BOOST', stock: 100 },
        { name: 'Verified Worker Frame', description: 'Stand out with an exclusive verified profile frame. Shows trust and reliability.', price: 500, currency: 'NGN', category: 'COSMETIC', stock: 200 },
        { name: 'Priority Support (30 days)', description: 'Skip the queue with priority customer support access for 30 days.', price: 5000, currency: 'NGN', category: 'SERVICE', stock: 30 },
        { name: 'Profile Spotlight (7 days)', description: 'Get featured on the homepage worker spotlight section for 7 days.', price: 3000, currency: 'NGN', category: 'BOOST', stock: 20 },
        { name: 'Custom Username Color', description: 'Change your username color to any color you want. Stand out in the community.', price: 1000, currency: 'NGN', category: 'COSMETIC', stock: 100 },
        { name: 'Withdrawal Fee Waiver (1 use)', description: 'One free withdrawal — we cover the processing fee for your next payout.', price: 800, currency: 'NGN', category: 'SERVICE', stock: 150 },
        { name: 'OgaPay T-Shirt (physical)', description: 'Limited edition OgaPay branded T-shirt. Delivery within 2 weeks.', price: 7000, currency: 'NGN', category: 'MERCH', stock: 10 },
      ],
    });
    console.log('Store items seeded');
  } else {
    console.log('Store items already exist, skipping');
  }

  // ── Communities ─────────────────────────────────────────
  const existingCommunities = await prisma.community.count();
  if (existingCommunities === 0) {
    const comm1 = await prisma.community.create({
      data: {
        name: 'OgaPay Official', slug: 'ogapay-official',
        description: 'The official OgaPay community. Get task announcements, tips, earn strategies, and community support.',
        iconUrl: 'https://ogapay.io/assets/communities/ogapay.png', accentColor: '#033CE3',
        category: 'social', isPublic: true, ownerId: admin.id,
      },
    });
    const comm2 = await prisma.community.create({
      data: {
        name: 'Nigerian Creators Hub', slug: 'ng-creators',
        description: 'For Nigerian content creators, designers, and writers. Share gigs, get feedback, and collaborate.',
        iconUrl: 'https://ogapay.io/assets/communities/creators.png', accentColor: '#16A34A',
        category: 'content', isPublic: true, ownerId: poster.id,
      },
    });

    // Add all users as members
    const allUsers = [admin, worker, poster, ...betaRecords];
    for (const u of allUsers) {
      await prisma.communityMember.create({
        data: { communityId: comm1.id, userId: u.id, role: u.id === admin.id ? 'OWNER' : 'MEMBER' },
      });
      await prisma.communityMember.create({
        data: { communityId: comm2.id, userId: u.id, role: u.id === poster.id ? 'OWNER' : 'MEMBER' },
      });
    }
    console.log('Communities seeded with members');
  } else {
    console.log('Communities already exist, skipping');
  }

  console.log('\nSeed complete!');
  console.log('   Admin: admin@ogapay.io / Admin@ogapay123');
  console.log('   Worker: chidi@example.com / Worker@123');
  console.log('   Poster: amaka@startup.ng / Poster@123');
  console.log('   Beta: zainab/tunde/grace/emeka @example.com / Beta@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
