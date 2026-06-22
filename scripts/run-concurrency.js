'use strict';

const BASE = 'https://ogapay.app/api/v1';
const POSTER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MTcyM2JkMi01ZGE1LTRjNjItYmQwOC0zMjRjNGMyNzBiMjEiLCJlbWFpbCI6InQxNzgyMTU1MjgzODk1QG1haWx0ZXN0Lnh5eiIsInJvbGUiOiJQT1NURVIiLCJpYXQiOjE3ODIxNTUyODYsImV4cCI6MTc4Mjc2MDA4Nn0.NNfGrR94HFg6VnAdh0KRmylB5EmjyyASq-XyJUN5378';
const WORKER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4MjI1NzRhNS0wOGY5LTRkNzUtYmI2Zi0zNzk0YjEyNTIxOWQiLCJlbWFpbCI6IncxNzgyMTU1MzA2MjM2QG1haWx0ZXN0Lnh5eiIsInJvbGUiOiJXT1JLRVIiLCJpYXQiOjE3ODIxNTUzMDksImV4cCI6MTc4Mjc2MDEwOX0.KOZ_sADd0q_oeQPDtga3p5228yoKvZ7nIMaLI_c9hEg';

let passed = 0, failed = 0;

const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const assert = (c, m) => { if (!c) throw new Error(m); };
const test = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed++; }
};

const POSTER_AUTH = auth(POSTER_TOKEN);
const WORKER_AUTH = auth(WORKER_TOKEN);

async function createTaskAcceptSubmit(prefix) {
  const t1 = await api('/tasks', {
    method: 'POST', headers: POSTER_AUTH,
    body: JSON.stringify({
      title: `${prefix} ${Date.now()}`, description: 'This is a concurrency test for verifying atomic updates on OgaPay',
      category: 'OTHER', reward: 100, currency: 'NGN', maxWorkers: 1,
      instructions: 'Submit a short proof', proofRequired: 'Text',
      tags: ['test'], estimatedTime: 5,
    }),
  });
  if (!t1.ok) throw new Error(`Create: ${t1.body.message}`);
  const taskId = t1.body.data.id;

  const apply = await api(`/tasks/${taskId}/apply`, { method: 'POST', headers: WORKER_AUTH });
  if (!apply.ok) throw new Error(`Apply: ${apply.body.message}`);

  const submit = await api(`/tasks/${taskId}/submit`, {
    method: 'POST', headers: WORKER_AUTH,
    body: JSON.stringify({ proof: `Proof ${Date.now()}` }),
  });
  if (!submit.ok) throw new Error(`Submit: ${submit.body.message}`);
  return { taskId, submissionId: submit.body.data.id };
}

async function main() {
  console.log('═══ OgaPay Concurrency Verification Tests ═══\n');

  // ═══════════════════════════════════════════════
  // Test 1: 10 concurrent approves
  // ═══════════════════════════════════════════════
  console.log('── Test 1: 10 simultaneous approves ──');
  const { taskId: t1Id, submissionId: t1Sub } = await createTaskAcceptSubmit('TEST1');
  console.log(`  Task: ${t1Id}, Submission: ${t1Sub}`);

  const t1 = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      api(`/tasks/submissions/${t1Sub}/review`, {
        method: 'PATCH', headers: POSTER_AUTH,
        body: JSON.stringify({ status: 'APPROVED' }),
      }).then(r => r.status))
  );
  const s1 = t1.map(r => r.status === 'fulfilled' ? r.value : 'ERR');
  const ok1 = s1.filter(s => s === 200).length;
  const conf1 = s1.filter(s => s === 409).length;
  console.log(`  200×${ok1}  409×${conf1}  other:${s1.filter(s => s !== 200 && s !== 409).join(',')}`);
  await test('Exactly 1 approve succeeds (200)', () => assert(ok1 === 1, `got ${ok1}`));
  await test('Exactly 9 get 409 Conflict', () => assert(conf1 === 9, `got ${conf1}`));

  // Verify wallet credit
  const wb = await api('/wallets/balance', { headers: WORKER_AUTH });
  const ngn = wb.body.data?.NGN;
  console.log('  Worker NGN after approve:', ngn);
  await test('Worker NGN balance >= 100', () => assert(ngn?.balance >= 100, `balance=${ngn?.balance}`));

  // Verify submission is APPROVED
  const subs1 = await api(`/tasks/${t1Id}/submissions`, { headers: POSTER_AUTH });
  const sub1 = subs1.body.data?.find(s => s.id === t1Sub);
  if (sub1) await test('Submission status = APPROVED', () => assert(sub1.status === 'APPROVED', `got ${sub1.status}`));

  // ═══════════════════════════════════════════════
  // Test 2: 10 concurrent rejects
  // ═══════════════════════════════════════════════
  console.log('\n── Test 2: 10 simultaneous rejects ──');
  const { taskId: t2Id, submissionId: t2Sub } = await createTaskAcceptSubmit('REJ1');
  console.log(`  Task: ${t2Id}, Submission: ${t2Sub}`);

  const t2 = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      api(`/tasks/submissions/${t2Sub}/reject`, {
        method: 'PATCH', headers: POSTER_AUTH,
        body: JSON.stringify({}),
      }).then(r => r.status))
  );
  const s2 = t2.map(r => r.status === 'fulfilled' ? r.value : 'ERR');
  const ok2 = s2.filter(s => s === 200).length;
  const conf2 = s2.filter(s => s === 409).length;
  console.log(`  200×${ok2}  409×${conf2}  other:${s2.filter(s => s !== 200 && s !== 409).join(',')}`);
  await test('Exactly 1 reject succeeds (200)', () => assert(ok2 === 1, `got ${ok2}`));
  await test('Exactly 9 get 409 Conflict', () => assert(conf2 === 9, `got ${conf2}`));

  const subs2 = await api(`/tasks/${t2Id}/submissions`, { headers: POSTER_AUTH });
  const sub2 = subs2.body.data?.find(s => s.id === t2Sub);
  if (sub2) await test('Submission status = REJECTED', () => assert(sub2.status === 'REJECTED', `got ${sub2.status}`));

  // ═══════════════════════════════════════════════
  // Test 4: Earnings endpoint
  // ═══════════════════════════════════════════════
  console.log('\n── Test 4: GET /users/me/earnings ──');
  const earn = await api('/users/me/earnings', { headers: WORKER_AUTH });
  console.log(`  Status: ${earn.status}`);
  await test('Earnings returns 200', () => assert(earn.ok));
  if (earn.ok) {
    const total = Number(earn.body.data?.totalEarned || 0);
    await test('totalEarned > 0', () => assert(total > 0, `got ${total}`));
    console.log('  totalEarned:', total);
  }

  // ═══════════════════════════════════════════════
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
