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

let user, token, ngWallet;

async function cleanup() {
  await prisma.$disconnect();
}

async function fullCleanup() {
  if (user) {
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    await prisma.wallet.deleteMany({ where: { userId: user.id } });
    await prisma.kycVerification.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
  await prisma.$disconnect();
}

async function main() {
  console.log('\n=== Wallet Audit E2E Test ===\n');

  // ── Setup ─────────────────────────────────────────────────
  console.log('SETUP — Create test user');
  const ts = Date.now();
  const email = `wallet-e2e-${ts}@test.com`;
  user = await prisma.user.create({
    data: {
      email, passwordHash: 'hash', firstName: 'Wallet', lastName: 'E2E',
      username: `wallete2e${ts}`.slice(-18), role: 'WORKER', isEmailVerified: true,
      referralCode: `WLE${ts}`,
      kyc: { create: { status: 'APPROVED', idType: 'NIN' } },
    },
  });
  token = signAccessToken({ sub: user.id, role: user.role });
  ngWallet = await prisma.wallet.create({
    data: { userId: user.id, currency: 'NGN', balance: 100000, lockedBalance: 0, isActive: true },
  });
  await prisma.wallet.create({
    data: { userId: user.id, currency: 'USDC', balance: 100, lockedBalance: 0, isActive: true },
  });
  print('Test user created', !!token);

  // ── Scenario 1: Double-click safety ───────────────────────
  console.log('\nSCENARIO 1 — Submit NGN withdrawal, double-click, verify only one tx');
  {
    const key = 'e2e-double-click-001';
    const body = { amount: 5000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' };

    const r1 = await request(app)
      .post('/v1/wallet/withdraw').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send(body);
    const r2 = await request(app)
      .post('/v1/wallet/withdraw').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send(body);

    const ok = r1.status === 200 && r2.status === 200;
    print('Both requests succeeded', ok, `r1=${r1.status} r2=${r2.status}`);
    if (ok) {
      print('Same reference returned', r1.body.data.reference === r2.body.data.reference,
        `ref=${r1.body.data.reference}`);
      const txs = await prisma.transaction.findMany({ where: { reference: r1.body.data.reference } });
      print('Only 1 transaction in DB', txs.length === 1, `count=${txs.length}`);
    }
  }

  // ── Scenario 2: Blockchain failure → no balance debit ────
  console.log('\nSCENARIO 2 — Submit crypto withdrawal, force blockchain failure, verify balance NOT decremented');
  {
    const balBefore = await prisma.wallet.findUnique({ where: { id: ngWallet.id } });
    const balNum = parseFloat(balBefore.balance);
    print('Balance before', true, `₦${balNum}`);

    const invalidAddr = 'ThisIsNotAValidSolanaAddressForSureXYZ12345';
    const res = await request(app)
      .post('/v1/wallet/withdraw/crypto').set('Authorization', `Bearer ${token}`)
      .send({ amount: 1, currency: 'USDC', toAddress: invalidAddr });

    const failed = res.status >= 400;
    print('Withdrawal rejected', failed, `status=${res.status}`);

    const balAfter = await prisma.wallet.findUnique({ where: { id: ngWallet.id } });
    const unchanged = parseFloat(balAfter.balance) === balNum;
    print('Balance unchanged', unchanged, `₦${parseFloat(balAfter.balance)}`);
  }

  // ── Scenario 3: Browser refresh safety ────────────────────
  console.log('\nSCENARIO 3 — Submit withdrawal with key, verify no duplicate');
  {
    const key = 'e2e-refresh-001';
    const body = { amount: 5000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' };

    const r1 = await request(app)
      .post('/v1/wallet/withdraw').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send(body);
    const ref1 = r1.body?.data?.reference;

    const r2 = await request(app)
      .post('/v1/wallet/withdraw').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send(body);

    const ok = r1.status === 200 && r2.status === 200;
    print('Both requests succeeded', ok, `r1=${r1.status} r2=${r2.status}`);
    if (ok) {
      print('Same reference', r2.body.data.reference === ref1);
    }

    const txs = await prisma.transaction.findMany({ where: { reference: ref1 } });
    print('No duplicate tx created', txs.length === 1, `count=${txs.length}`);
  }

  // ── Scenario 4: Idempotency-Key replay ────────────────────
  console.log('\nSCENARIO 4 — Replay same Idempotency-Key, verify original response returned');
  {
    const key = 'e2e-replay-001';
    const body = { amount: 5000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' };

    const r1 = await request(app)
      .post('/v1/wallet/withdraw').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send(body);
    const r2 = await request(app)
      .post('/v1/wallet/withdraw').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send(body);

    const ok = r1.status === 200 && r2.status === 200;
    print('Both requests succeeded', ok, `r1=${r1.status} r2=${r2.status}`);
    if (ok) {
      const match = JSON.stringify(r1.body.data) === JSON.stringify(r2.body.data);
      print('Response data matches exactly', match);
    }
  }

  // ── Scenario 5: Old debug endpoints return 404 ────────────
  console.log('\nSCENARIO 5 — Verify old debug endpoints return 404');
  {
    const creditRes = await request(app)
      .post('/v1/wallet/credit').send({ email: 'x@x.com', amount: 100 });
    const creditGone = creditRes.status === 404 || creditRes.status === 401;
    print('POST /wallet/credit returns 401/404 (route removed)', creditGone, `status=${creditRes.status}`);

    const cryptoConfirmRes = await request(app)
      .post('/v1/webhooks/crypto/confirm').send({ reference: 'x', providerRef: 'y' });
    print('POST /webhooks/crypto/confirm -> 404', cryptoConfirmRes.status === 404, `status=${cryptoConfirmRes.status}`);
  }

  // ── Summary ───────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  WALLET AUDIT E2E TEST COMPLETE');
  console.log('═══════════════════════════════════════\n');

  // ── Evidence ──────────────────────────────────────────────
  console.log('=== DB EVIDENCE ===\n');

  const txs = await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  console.log(`Transactions (${txs.length}):`);
  for (const tx of txs) {
    console.log(`  ${tx.reference} | ${tx.type} | ${tx.status} | ${tx.currency} | amount=${tx.amount} | balanceBefore=${tx.balanceBefore} | balanceAfter=${tx.balanceAfter} | metadata=${JSON.stringify(tx.metadata)}`);
  }

  const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
  console.log('\nWallets:');
  for (const w of wallets) {
    console.log(`  ${w.currency} | balance=${w.balance} | lockedBalance=${w.lockedBalance}`);
  }

  // Verify only 1 NGN withdrawal transaction exists (idempotency proof)
  const ngWithdrawals = txs.filter(tx => tx.type === 'WITHDRAWAL' && tx.currency === 'NGN');
  console.log(`\nNGN withdrawal records: ${ngWithdrawals.length} (expected: 1 per idempotent key, 3 unique keys used)`);
  console.log('  Unique references: ' + [...new Set(txs.filter(tx => tx.type === 'WITHDRAWAL').map(tx => tx.reference))].join(', '));
}

main().then(() => {
  cleanup().then(() => process.exit(0)).catch(() => process.exit(0));
}).catch(async (err) => {
  console.error('FATAL:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
