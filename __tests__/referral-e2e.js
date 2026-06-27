'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_access_secret_32_chars_minimum';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_32_chars_minimum';

const request = require('supertest');
const app = require('../src/index');
const { prisma } = require('../src/config/database');
const { signAccessToken } = require('../src/utils/jwt');

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const print = (label, ok, detail = '') => console.log(`  [${ok ? PASS : FAIL}] ${label}${detail ? ' — ' + detail : ''}`);

let referrer, referrerToken, referredUser, noRefUser;
let testEmailIndex = 0;

function makeEmail(label) {
  testEmailIndex++;
  const ts = Date.now();
  return `ref${label}${ts}${testEmailIndex}@test.com`;
}

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: '@test.com' } },
    select: { id: true },
  });
  const ids = testUsers.map(u => u.id);
  if (ids.length > 0) {
    await prisma.transaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.kycVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}

async function createUser(email, refCode = null) {
  const res = await request(app)
    .post('/v1/auth/signup')
    .send({
      firstName: 'Test', lastName: 'User',
      email, password: 'TestPass123!',
      username: email.split('@')[0],
      referralCode: refCode,
    });
  return res;
}

async function createDirectUser(email, role = 'WORKER') {
  const u = await prisma.user.create({
    data: {
      email,
      passwordHash: 'hash',
      firstName: 'Test', lastName: 'User',
      username: email.split('@')[0] + Math.random().toString(36).slice(2, 6),
      role,
      isEmailVerified: true,
      referralCode: 'DIR_' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    },
  });
  await prisma.wallet.createMany({
    data: ['NGN', 'USDC', 'USDT', 'SOL'].map(c => ({
      userId: u.id, currency: c, balance: 0, lockedBalance: 0,
    })),
  });
  return u;
}

async function main() {
  console.log('\n=== Referral System E2E Test ===\n');

  // ── Setup: create a referrer ─────────────────────────────
  console.log('SETUP — Create referrer');
  const refEmail = makeEmail('referrer');
  const refRes = await createUser(refEmail);
  referrer = refRes.body?.data?.user;
  const ok = refRes.status === 201 && referrer?.referralCode;
  print('Referrer account created', ok, `status=${refRes.status} code=${referrer?.referralCode}`);
  if (!ok) throw new Error('Setup failed: cannot create referrer');

  // ── Scenario 1: Normal referral signup ───────────────────
  console.log('\nSCENARIO 1 — Normal referral signup');
  {
    const referredEmail = makeEmail('referred');
    const r1 = await createUser(referredEmail, referrer.referralCode);
    const refOk = r1.status === 201;
    print('Referred user registration', refOk, `status=${r1.status}`);
    if (refOk) {
      referredUser = r1.body.data.user;
      const dbUser = await prisma.user.findUnique({ where: { id: referredUser.id }, select: { referredById: true } });
      print(' referredById matches referrer', dbUser.referredById === referrer.id, `referredById=${dbUser.referredById}`);
    }
  }

  // ── Scenario 2: Signup without referral ──────────────────
  console.log('\nSCENARIO 2 — Signup without referral');
  {
    const noRefEmail = makeEmail('noref');
    const r2 = await createUser(noRefEmail);
    const noRefOk = r2.status === 201;
    print('No-referral registration succeeds', noRefOk, `status=${r2.status}`);
    if (noRefOk) {
      noRefUser = r2.body.data.user;
      const dbUser = await prisma.user.findUnique({ where: { id: noRefUser.id }, select: { referredById: true } });
      print(' referredById is null', dbUser.referredById === null, `referredById=${dbUser.referredById}`);
    }
  }

  // ── Scenario 3: Invalid referral code ────────────────────
  console.log('\nSCENARIO 3 — Invalid referral code');
  {
    const badEmail = makeEmail('badref');
    const r3 = await createUser(badEmail, 'INVALID123');
    const badRefOk = r3.status === 400;
    print('Invalid code returns 400', badRefOk, `status=${r3.status}`);
  }

  // ── Scenario 4: Reward for self-referral prevention / no-referrer safety ──
  console.log('\nSCENARIO 4 — No self-reward for user without referrer');
  {
    const walletService = require('../src/services/wallet.service');
    // A user with no referrer should never get a reward
    const result = await walletService.rewardForReferral(noRefUser.id);
    print('rewardForReferral returns null for no-referrer user', result === null, `result=${JSON.stringify(result)}`);
  }

  // ── Scenario 5: Duplicate reward prevention ──────────────
  console.log('\nSCENARIO 5 — Duplicate reward prevention');
  {
    // Create a fresh referred user for this test
    const dupEmail = makeEmail('dupref');
    const dupRes = await createUser(dupEmail, referrer.referralCode);
    if (dupRes.status !== 201) { print('Setup: duplicate test user creation failed', false); return; }
    const dupUser = dupRes.body.data.user;

    // Manually set email verified to trigger reward
    await prisma.user.update({ where: { id: dupUser.id }, data: { isEmailVerified: true } });

    // Call rewardForReferral twice
    const walletService = require('../src/services/wallet.service');
    const r1 = await walletService.rewardForReferral(dupUser.id);
    const r2 = await walletService.rewardForReferral(dupUser.id);

    print('First reward issued', !!r1, r1 ? `ref=${r1.reference} amount=${r1.amount}` : 'null');
    print('Second reward prevented (null)', r2 === null, `result=${JSON.stringify(r2)}`);

    // Verify only one REFERRAL_BONUS transaction
    const bonuses = await prisma.transaction.findMany({ where: { userId: referrer.id, type: 'REFERRAL_BONUS' } });
    print('Only 1 REFERRAL_BONUS tx in DB', bonuses.length === 1, `count=${bonuses.length}`);

    // Verify wallet credited exactly once
    const refWallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId: referrer.id, currency: 'NGN' } } });
    const expectedBalance = 1000;
    print('Referrer wallet has ₦1,000 bonus', parseFloat(refWallet.balance) >= expectedBalance, `balance=${refWallet.balance}`);
  }

  // ── Scenario 6: Reward issuance after milestone ──────────
  console.log('\nSCENARIO 6 — Reward after KYC milestone');
  {
    // Create a referred user who hasn't verified email yet
    const kycEmail = makeEmail('kycref');
    const kycRes = await createUser(kycEmail, referrer.referralCode);
    if (kycRes.status !== 201) { print('Setup: KYC test user creation failed', false); return; }
    const kycUser = kycRes.body.data.user;

    // Reward should NOT trigger yet (no milestone)
    const walletService = require('../src/services/wallet.service');
    const preMilestone = await walletService.rewardForReferral(kycUser.id);
    print('No reward before milestone', preMilestone === null, `result=${JSON.stringify(preMilestone)}`);

    // Now approve KYC
    await prisma.kycVerification.upsert({
      where: { userId: kycUser.id },
      create: { userId: kycUser.id, status: 'APPROVED', kycTier: 1, verifiedAt: new Date() },
      update: { status: 'APPROVED', kycTier: 1, verifiedAt: new Date() },
    });

    const postMilestone = await walletService.rewardForReferral(kycUser.id);
    print('Reward issued after KYC milestone', !!postMilestone, `ref=${postMilestone?.reference}`);

    // Verify the referralRewardedAt is set
    const updatedUser = await prisma.user.findUnique({ where: { id: kycUser.id }, select: { referralRewardedAt: true } });
    print('referralRewardedAt is set', !!updatedUser.referralRewardedAt, `at=${updatedUser.referralRewardedAt}`);
  }

  // ── Stats endpoint ───────────────────────────────────────
  console.log('\nSTATS — Referral stats endpoint');
  {
    referrerToken = signAccessToken({ sub: referrer.id, role: referrer.role });
    const statsRes = await request(app)
      .get('/v1/users/referrals/stats')
      .set('Authorization', `Bearer ${referrerToken}`);
    const statsOk = statsRes.status === 200;
    print('GET /referrals/stats -> 200', statsOk, `status=${statsRes.status}`);
    if (statsOk) {
      const d = statsRes.body.data;
      print(' referralCode present', !!d.referralCode, `code=${d.referralCode}`);
      print(' referralLink present', !!d.referralLink, `link=${d.referralLink}`);
      print(' totalReferrals >= 3', d.totalReferrals >= 3, `count=${d.totalReferrals}`);
      print(' rewardedReferrals >= 2', d.rewardedReferrals >= 2, `count=${d.rewardedReferrals}`);
      print(' totalEarned >= 2000', d.totalEarned >= 2000, `earned=${d.totalEarned}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  REFERRAL SYSTEM E2E TEST COMPLETE');
  console.log('═══════════════════════════════════════\n');
}

main().then(() => {
  cleanup().then(() => process.exit(0)).catch(() => process.exit(0));
}).catch(async (err) => {
  console.error('FATAL:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
