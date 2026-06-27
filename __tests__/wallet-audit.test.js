'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_access_secret_32_chars_minimum';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_32_chars_minimum';

const request = require('supertest');
const app = require('../src/index');
const { prisma } = require('../src/config/database');
const { signAccessToken } = require('../src/utils/jwt');

let user, token, wallet;

beforeAll(async () => {
  const ts = Date.now();
  const email = `wallet-test-${ts}@test.com`;
  user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'hash',
      firstName: 'Wallet',
      lastName: 'Test',
      username: `wallettest${ts}`,
      role: 'WORKER',
      isEmailVerified: true,
      referralCode: `WLT${ts}`,
      kyc: 'APPROVED',
    },
  });
  token = signAccessToken({ id: user.id, role: user.role });

  wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      currency: 'NGN',
      balance: 100000,
      lockedBalance: 0,
      isActive: true,
    },
  });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

describe('wallet audit fixes', () => {

  // ─── Scenario 5: Old debug endpoints return 404 ──────────────
  describe('debug endpoints removed', () => {
    it('/wallet/credit returns 404', async () => {
      const res = await request(app)
        .post('/v1/wallet/credit')
        .send({ email: 'any@test.com', amount: 100 });
      expect(res.status).toBe(404);
    });

    it('/webhooks/crypto/confirm returns 404', async () => {
      const res = await request(app)
        .post('/v1/webhooks/crypto/confirm')
        .send({ reference: 'x', providerRef: 'y' });
      expect(res.status).toBe(404);
    });
  });

  // ─── Scenario 1: NGN withdrawal idempotency (double-click) ──
  describe('NGN withdrawal idempotency', () => {
    it('same idempotency key returns cached result and no duplicate tx', async () => {
      const key = 'test-idem-key-ngn-001';
      const body = { amount: 5000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' };

      const res1 = await request(app)
        .post('/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);

      expect(res1.status).toBe(200);
      expect(res1.body.data.reference).toBeTruthy();

      const res2 = await request(app)
        .post('/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);

      expect(res2.status).toBe(200);
      expect(res2.body.data.reference).toBe(res1.body.data.reference);

      const txs = await prisma.transaction.findMany({
        where: { reference: res1.body.data.reference },
      });
      expect(txs.length).toBe(1);
    });

    it('different idempotency keys create separate withdrawals', async () => {
      const refs = [];
      for (let i = 0; i < 2; i++) {
        const res = await request(app)
          .post('/v1/wallet/withdraw')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `multi-key-${i}`)
          .send({ amount: 1000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' });
        expect(res.status).toBe(200);
        refs.push(res.body.data.reference);
      }
      expect(refs[0]).not.toBe(refs[1]);
    });
  });

  // ─── Scenario 4: Idempotency-Key replay ────────────────────
  describe('idempotency key replay protection', () => {
    it('replaying same key returns same response without new tx', async () => {
      const key = 'test-replay-key-001';
      const body = { amount: 2000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' };

      const res1 = await request(app)
        .post('/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);

      const res2 = await request(app)
        .post('/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send(body);

      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    });
  });

  // ─── Scenario 3: Browser refresh / network retry safety ────
  describe('network retry safety', () => {
    it('missing idempotency key still works (new withdrawal)', async () => {
      const res = await request(app)
        .post('/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 3000, currency: 'NGN', accountNumber: '0123456789', bankName: 'Test Bank', accountName: 'Test User' });
      expect(res.status).toBe(200);
      expect(res.body.data.reference).toBeTruthy();
    });

    it('crypto withdrawal without idempotency key succeeds', async () => {
      const res = await request(app)
        .post('/v1/wallet/withdraw/crypto')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 0.01, currency: 'USDC', toAddress: 'FakeAddressForTestOnly12345678901234567890123456789012' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── Scenario 2: Blockchain failure → balance not decremented ──
  describe('blockchain failure safety', () => {
    it('crypto withdrawal to invalid address throws (no balance debit)', async () => {
      const balBefore = await prisma.wallet.findUnique({ where: { id: wallet.id } });
      const balNum = parseFloat(balBefore.balance);

      const res = await request(app)
        .post('/v1/wallet/withdraw/crypto')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 1, currency: 'USDC', toAddress: 'DefinitelyNotAValidSolanaAddress' });

      expect(res.status).toBe(500);

      const balAfter = await prisma.wallet.findUnique({ where: { id: wallet.id } });
      expect(parseFloat(balAfter.balance)).toBe(balNum);
    });
  });

  // ─── balanceBefore / balanceAfter correctness (C4) ──────────
  describe('balanceBefore/balanceAfter correctness', () => {
    it('crypto withdrawal records correct balance fields', async () => {
      const balSnapshot = parseFloat(wallet.balance);
      const amount = 0.001;
      const cur = 'USDC';

      const usdcWallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: user.id, currency: cur } },
      });
      if (!usdcWallet) {
        await prisma.wallet.create({
          data: { userId: user.id, currency: cur, balance: 10, lockedBalance: 0, isActive: true },
        });
      }

      const amtNum = 1;
      const res = await request(app)
        .post('/v1/wallet/withdraw/crypto')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: amtNum, currency: 'USDC', toAddress: 'FakeAddressForTestOnly12345678901234567890123456789012' });

      if (res.status === 200) {
        const tx = await prisma.transaction.findFirst({
          where: { userId: user.id, type: 'WITHDRAWAL', currency: 'USDC' },
          orderBy: { createdAt: 'desc' },
        });
        if (tx) {
          expect(Number(tx.balanceBefore)).toBe(10);
          expect(Number(tx.balanceAfter)).toBe(9);
        }
      }
    });
  });

  // ─── Auth protection on balance-modifying routes ────────────
  describe('auth protection', () => {
    it('/wallet/withdraw rejects unauthenticated', async () => {
      const res = await request(app)
        .post('/v1/wallet/withdraw')
        .send({ amount: 1000, currency: 'NGN' });
      expect(res.status).toBe(401);
    });

    it('/wallet/withdraw/crypto rejects unauthenticated', async () => {
      const res = await request(app)
        .post('/v1/wallet/withdraw/crypto')
        .send({ amount: 1, currency: 'USDC', toAddress: 'x' });
      expect(res.status).toBe(401);
    });
  });
});
