'use strict';

// Integration test: DELETE /api/v1/users/me refuses (409) while the account
// still holds money or has open activity, and needs the password (or typing
// DELETE on accounts without one).
//
// Real user routes, auth middleware, services and Prisma client, against an
// in-memory Postgres (PGlite) built from prisma/schema.prisma, so it never
// touches a real database.
//
//   npm run test:account-delete

const path = require('path');
const { execFileSync } = require('child_process');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PGLITE_PORT || 5439);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'account-delete-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'account-delete-test-refresh-secret';
process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable&connection_limit=1`;
process.env.DIRECT_URL = process.env.DATABASE_URL;

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 400) : ''}`);
};

(async () => {
  // ── In-memory Postgres with the app's schema ─────────────────────────────
  const schemaSql = execFileSync(process.execPath, [
    path.join(ROOT, 'node_modules/prisma/build/index.js'),
    'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(ROOT, 'prisma/schema.prisma'), '--script',
  ], { cwd: ROOT, encoding: 'utf8' });
  const pg = await PGlite.create();
  await pg.exec(schemaSql);
  const server = new PGLiteSocketServer({ db: pg, port: PORT, host: '127.0.0.1' });
  await server.start();

  require('express-async-errors');
  const express = require('express');
  const request = require('supertest');
  const bcrypt = require('bcryptjs');
  const { prisma } = require('../src/config/database');
  const { signAccessToken } = require('../src/utils/jwt');
  require('../src/utils/logger').logger.silent = true;

  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', require('../src/routes/user.routes'));
  app.use(require('../src/middleware/errorHandler').errorHandler);

  // ── Fixtures ─────────────────────────────────────────────────────────────
  const PASSWORD = 'correct horse battery';
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  let n = 0;
  const mkUser = async ({ password = true } = {}) => {
    n += 1;
    const u = await prisma.user.create({
      data: {
        email: `user${n}@test.io`, firstName: 'Test', lastName: `User${n}`, username: `user${n}`,
        referralCode: `REF${n}`, passwordHash: password ? passwordHash : null,
      },
    });
    const wallet = await prisma.wallet.create({ data: { userId: u.id, currency: 'NGN' } });
    return { id: u.id, email: u.email, walletId: wallet.id, token: signAccessToken({ sub: u.id, email: u.email, role: u.role }) };
  };
  const mkTask = (posterId, data = {}) => prisma.task.create({
    data: { posterId, title: `Job ${++n}`, description: 'Test job', category: 'OTHER', reward: 1000, status: 'OPEN', ...data },
  });
  const mkSubmission = async (workerId, status, posterId) => {
    const poster = posterId || (await mkUser()).id;
    const task = await mkTask(poster, { status: 'COMPLETED' });
    return prisma.taskSubmission.create({ data: { taskId: task.id, workerId, status } });
  };
  const mkStoreOrder = async ({ buyerId, sellerId, status }) => {
    const item = await prisma.storeItem.create({
      data: { sellerId, name: `Item ${++n}`, description: 'Test item', price: 500, category: 'design' },
    });
    return prisma.storePurchase.create({ data: { userId: buyerId, itemId: item.id, totalPrice: 500, currency: 'NGN', status } });
  };
  const pool = await prisma.vaultPool.create({ data: {} });
  const dist = await prisma.vaultDistribution.create({ data: { poolId: pool.id } });

  const check = (u) => request(app).get('/api/v1/users/me/delete-check').set('Authorization', `Bearer ${u.token}`);
  const del = (u, body) => {
    const r = request(app).delete('/api/v1/users/me').set('Authorization', `Bearer ${u.token}`);
    return body === undefined ? r : r.send(body);
  };
  const isDeleted = async (u) => {
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { isBanned: true, email: true } });
    return row.isBanned && row.email === `deleted_${u.id}@ogapay.com`;
  };
  const untouched = async (u) => {
    const row = await prisma.user.findUnique({ where: { id: u.id }, select: { isBanned: true, email: true } });
    return !row.isBanned && row.email === u.email;
  };
  const codes = (res) => (res.body.errors || []).map((b) => b.code);

  // Expect deletion (with the right password) to be refused because of `code`
  const expectBlocked = async (name, u, code, messageIncludes) => {
    const res = await del(u, { password: PASSWORD });
    const cond = res.status === 409 && codes(res).includes(code) && (await untouched(u))
      && (!messageIncludes || res.body.message.includes(messageIncludes));
    ok(name, cond, { status: res.status, message: res.body.message, codes: codes(res) });
    return res;
  };
  const expectAllowed = async (name, u) => {
    const res = await del(u, { password: PASSWORD });
    ok(name, res.status === 200 && (await isDeleted(u)), { status: res.status, message: res.body.message });
  };

  // ── Confirmation: password ───────────────────────────────────────────────
  let u = await mkUser();
  let r = await check(u);
  ok('delete-check: clean account can be deleted, confirm with password',
    r.status === 200 && r.body.data.canDelete === true && r.body.data.blockers.length === 0 && r.body.data.confirmWith === 'password', r.body);
  r = await del(u);
  ok('no body (the old one-click delete) is refused', r.status === 400 && /password/i.test(r.body.message) && (await untouched(u)), r.body);
  r = await del(u, { password: 'wrong password' });
  ok('wrong password is refused with 400, not 401', r.status === 400 && r.body.message === 'Incorrect password' && (await untouched(u)), r.body);
  r = await del(u, { confirm: 'DELETE' });
  ok('typing DELETE is not enough when the account has a password', r.status === 400 && (await untouched(u)), r.body);
  r = await del(u, { password: PASSWORD });
  ok('right password deletes the account', r.status === 200 && (await isDeleted(u)), r.body);
  r = await check(u);
  ok('the deleted account can no longer use its session', r.status === 403, r.body);

  // ── Confirmation: typing DELETE (no password, e.g. Google sign-up) ────────
  u = await mkUser({ password: false });
  r = await check(u);
  ok('delete-check: account without a password confirms by typing', r.body.data?.confirmWith === 'text', r.body);
  r = await del(u, {});
  ok('no confirmation is refused', r.status === 400 && /DELETE/.test(r.body.message) && (await untouched(u)), r.body);
  r = await del(u, { confirm: 'delete' });
  ok('lowercase "delete" is refused', r.status === 400 && (await untouched(u)), r.body);
  r = await del(u, { confirm: 'DELETE' });
  ok('typing DELETE deletes it', r.status === 200 && (await isDeleted(u)), r.body);

  // ── Wallet balances ──────────────────────────────────────────────────────
  u = await mkUser();
  await prisma.wallet.update({ where: { id: u.walletId }, data: { balance: 12500 } });
  r = await expectBlocked('naira balance blocks deletion', u, 'WALLET_BALANCE', '₦12,500');
  ok('...and says to withdraw or send it', /Withdraw it to your bank or send it to another OgaPay user/.test(r.body.message), r.body.message);
  r = await check(u);
  ok('delete-check lists it too', r.status === 200 && r.body.data.canDelete === false && r.body.data.blockers[0]?.code === 'WALLET_BALANCE', r.body);
  await prisma.wallet.update({ where: { id: u.walletId }, data: { balance: 0 } });
  await expectAllowed('once the balance is withdrawn, deletion goes through', u);

  u = await mkUser();
  await prisma.wallet.update({ where: { id: u.walletId }, data: { balance: 50 } });
  await expectBlocked('a balance under the ₦100 send minimum points to support', u, 'WALLET_BALANCE', 'contact support');

  u = await mkUser();
  await prisma.wallet.create({ data: { userId: u.id, currency: 'USDC', balance: 3.5 } });
  r = await expectBlocked('a crypto wallet balance blocks deletion', u, 'WALLET_BALANCE', '3.5 USDC');

  u = await mkUser();
  await prisma.wallet.create({ data: { userId: u.id, currency: 'PAY', balance: 10 } });
  await expectBlocked('a $PAY balance blocks deletion', u, 'WALLET_BALANCE', '$PAY');

  u = await mkUser();
  await prisma.wallet.update({ where: { id: u.walletId }, data: { balance: 2000, lockedBalance: 2000 } });
  r = await expectBlocked('funds on hold block deletion', u, 'FUNDS_ON_HOLD', '₦2,000');
  ok('...with nothing reported as available', !codes(r).includes('WALLET_BALANCE'), codes(r));

  // ── Jobs the user posted ─────────────────────────────────────────────────
  for (const status of ['OPEN', 'IN_PROGRESS', 'COOLING_DOWN', 'DISPUTED']) {
    u = await mkUser();
    await mkTask(u.id, { status, title: `My ${status} job` });
    await expectBlocked(`a posted ${status} job blocks deletion`, u, 'OPEN_JOBS', `"My ${status} job"`);
  }
  u = await mkUser();
  await mkTask(u.id, { status: 'DRAFT', escrowed: true });
  await expectBlocked('a paused (DRAFT) job that still holds escrow blocks deletion', u, 'OPEN_JOBS');

  u = await mkUser();
  for (const status of ['COMPLETED', 'CANCELLED', 'EXPIRED']) await mkTask(u.id, { status });
  await mkTask(u.id, { status: 'DRAFT', escrowed: false });
  await expectAllowed('finished, cancelled, expired and unfunded draft jobs do not block', u);

  // ── Withdrawals ──────────────────────────────────────────────────────────
  const mkWithdrawal = (usr, status) => prisma.transaction.create({
    data: {
      userId: usr.id, walletId: usr.walletId, type: 'WITHDRAWAL', status, amount: 6000, currency: 'NGN',
      reference: `WD-${++n}`, balanceBefore: 6000, balanceAfter: 0,
    },
  });
  for (const status of ['PENDING', 'PROCESSING']) {
    u = await mkUser();
    await mkWithdrawal(u, status);
    await expectBlocked(`a ${status} withdrawal blocks deletion`, u, 'PENDING_WITHDRAWALS');
  }
  u = await mkUser();
  await mkWithdrawal(u, 'COMPLETED');
  await mkWithdrawal(u, 'FAILED');
  await expectAllowed('completed and failed withdrawals do not block', u);

  // ── Vault payouts ────────────────────────────────────────────────────────
  u = await mkUser();
  await prisma.vaultPayout.create({ data: { distributionId: dist.id, userId: u.id, shareNgp: 1500, status: 'pending' } });
  await prisma.vaultPayout.create({ data: { distributionId: dist.id, userId: u.id, shareNgp: 250.5, status: 'pending' } });
  await expectBlocked('unclaimed vault payouts block deletion, with their total', u, 'VAULT_PAYOUTS', '₦1,750.50');
  u = await mkUser();
  await prisma.vaultPayout.create({ data: { distributionId: dist.id, userId: u.id, shareNgp: 1500, status: 'paid' } });
  await expectAllowed('a claimed vault payout does not block', u);

  // ── Store orders ─────────────────────────────────────────────────────────
  let buyer = await mkUser();
  let seller = await mkUser();
  await mkStoreOrder({ buyerId: buyer.id, sellerId: seller.id, status: 'PENDING' });
  await expectBlocked('an undelivered order blocks the buyer', buyer, 'STORE_ORDERS_BOUGHT');
  await expectBlocked('...and the seller', seller, 'STORE_ORDERS_SOLD');
  buyer = await mkUser();
  seller = await mkUser();
  await mkStoreOrder({ buyerId: buyer.id, sellerId: seller.id, status: 'IN_PROGRESS' });
  await expectBlocked('an in-progress order blocks the seller', seller, 'STORE_ORDERS_SOLD');
  buyer = await mkUser();
  seller = await mkUser();
  await mkStoreOrder({ buyerId: buyer.id, sellerId: seller.id, status: 'DELIVERED' });
  await expectAllowed('a delivered order does not block the buyer', buyer);
  await expectAllowed('...or the seller', seller);

  // ── Disputes ─────────────────────────────────────────────────────────────
  const mkDispute = async (workerId, posterId, resolved) => {
    const sub = await mkSubmission(workerId, 'DISPUTED', posterId);
    return prisma.dispute.create({
      data: {
        taskId: sub.taskId, submissionId: sub.id, workerId, posterId, reason: 'Test',
        ...(resolved && { resolvedAt: new Date(), outcome: 'POSTER_WON' }),
      },
    });
  };
  let worker = await mkUser();
  let poster = await mkUser();
  await mkDispute(worker.id, poster.id, false);
  await expectBlocked('an open dispute blocks the worker', worker, 'OPEN_DISPUTES');
  await expectBlocked('...and the poster', poster, 'OPEN_DISPUTES');
  worker = await mkUser();
  poster = await mkUser();
  await mkDispute(worker.id, poster.id, true);
  await expectAllowed('a resolved dispute does not block the worker', worker);
  await expectAllowed('...or the poster', poster);

  // ── Work awaiting review ─────────────────────────────────────────────────
  u = await mkUser();
  await mkSubmission(u.id, 'SUBMITTED');
  await expectBlocked('submitted work waiting for review blocks deletion', u, 'WORK_AWAITING_REVIEW');
  u = await mkUser();
  await mkSubmission(u.id, 'APPROVED');
  await mkSubmission(u.id, 'REJECTED');
  await expectAllowed('reviewed work does not block', u);

  // ── Several at once ──────────────────────────────────────────────────────
  u = await mkUser();
  await prisma.wallet.update({ where: { id: u.walletId }, data: { balance: 9000, lockedBalance: 3000 } });
  await mkTask(u.id, { status: 'OPEN' });
  await mkWithdrawal(u, 'PENDING');
  r = await del(u, { password: PASSWORD });
  const want = ['WALLET_BALANCE', 'FUNDS_ON_HOLD', 'OPEN_JOBS', 'PENDING_WITHDRAWALS'];
  ok('every blocker is reported at once', r.status === 409 && want.every((c) => codes(r).includes(c)) && (await untouched(u)), codes(r));
  ok('...and the message starts with what is wrong', /^You can't delete your account yet\. /.test(r.body.message), r.body.message);
  r = await check(u);
  ok('delete-check reports the same list', want.every((c) => r.body.data.blockers.some((b) => b.code === c)), r.body.data);

  // A wrong password is reported before anything else is looked at
  r = await del(u, { password: 'nope' });
  ok('wrong password still gets 400 on a blocked account', r.status === 400 && r.body.message === 'Incorrect password', r.body);

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  await prisma.$disconnect();
  await server.stop();
  await pg.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('CRASH', e);
  process.exit(2);
});
