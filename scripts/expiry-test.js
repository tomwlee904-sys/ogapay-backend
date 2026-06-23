'use strict';

const BASE = 'https://ogapay.app/api/v1';
const POST_EMAIL = 'post1782189842700@mailtest.xyz';
const POSTER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MjNlZTk0Ny1iNWQxLTQ2M2EtYmJhNi1hNDVhYmIyMjliZWYiLCJlbWFpbCI6InBvc3QxNzgyMTg5ODQyNzAwQG1haWx0ZXN0Lnh5eiIsInJvbGUiOiJQT1NURVIiLCJpYXQiOjE3ODIxODk4NDYsImV4cCI6MTc4Mjc5NDY0Nn0.fY9zDkShobe8x6lHyfxT3LqeA25e3IwchxAFLP6vUeY';

const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function createWorker() {
  const r = await api('/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `wk${Date.now()}${Math.random().toString(36).slice(2,5)}@mailtest.xyz`,
      password: 'Strong!Pass1', firstName: 'Wkr', lastName: 'Aud',
      username: `wk${Date.now()}${Math.random().toString(36).slice(2,8)}`, role: 'WORKER',
    }),
  });
  if (!r.ok) throw new Error(`Create worker: ${r.body.message}`);
  return r.body.data.tokens.accessToken;
}

async function createTaskWithDeadline(deadlineISO) {
  const r = await api('/tasks', {
    method: 'POST', headers: auth(POSTER_TOKEN),
    body: JSON.stringify({
      title: `EXP ${Date.now()}`,
      description: 'Expiry enforcement test task for OgaPay platform deadline checking',
      category: 'OTHER', reward: 50, currency: 'NGN', maxWorkers: 3,
      instructions: 'Submit', proofRequired: 'Text',
      deadline: deadlineISO, tags: ['expiry-test'], estimatedTime: 5,
    }),
  });
  if (!r.ok) throw new Error(`Create task: ${r.body.message}`);
  return r.body.data.id;
}

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); fail++; }
};

async function main() {
  console.log('═══ TASK EXPIRY ENFORCEMENT TESTS ═══\n');

  // Fund poster
  await fetch(`${BASE}/wallets/credit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: POST_EMAIL, amount: 5000, currency: 'NGN' }),
  });

  // ── Test 1: Task deadline = yesterday (apply rejected) ──
  console.log('── Test 1: Apply to expired task (past deadline) ──');
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const t1 = await createTaskWithDeadline(yesterday);
  const w1 = await createWorker();
  const r1 = await api(`/tasks/${t1}/apply`, { method: 'POST', headers: auth(w1) });
  await t('Expired task rejects apply', () => {
    if (r1.status !== 400) throw new Error(`Expected 400, got ${r1.status}: ${r1.body.message}`);
    if (!r1.body.message?.toLowerCase().includes('expir')) throw new Error(`Message not about expiry: "${r1.body.message}"`);
  });

  // ── Test 2: Task deadline = now (boundary, should reject) ──
  console.log('\n── Test 2: Apply to task expiring now ──');
  const now = new Date().toISOString();
  const t2 = await createTaskWithDeadline(now);
  const w2 = await createWorker();
  const r2 = await api(`/tasks/${t2}/apply`, { method: 'POST', headers: auth(w2) });
  await t('Expiring-now task rejects apply', () => {
    if (r2.status !== 400) throw new Error(`Expected 400, got ${r2.status}`);
  });

  // ── Test 3: Task deadline = future (apply succeeds) ──
  console.log('\n── Test 3: Apply to future-deadline task ──');
  const future = new Date(Date.now() + 86400000).toISOString();
  const t3 = await createTaskWithDeadline(future);
  const w3 = await createWorker();
  const r3 = await api(`/tasks/${t3}/apply`, { method: 'POST', headers: auth(w3) });
  await t('Future-deadline task accepts apply', () => {
    if (r3.status !== 201) throw new Error(`Expected 201, got ${r3.status}: ${r3.body.message}`);
  });

  // ── Test 4: Expired task detail shows EXPIRED ──
  console.log('\n── Test 4: GET expired task shows expired indicator ──');
  const t4 = await createTaskWithDeadline(yesterday);
  const r4 = await api(`/tasks/${t4}`, { headers: auth(w1) });
  await t('Expired task detail shows status EXPIRED', () => {
    const task = r4.body.data?.task || r4.body.data;
    if (!task) throw new Error('No task data');
    if (task.status !== 'EXPIRED') throw new Error(`Expected EXPIRED, got ${task.status}`);
  });

  // ── Test 5: Submit to expired task ──
  console.log('\n── Test 5: Submit to expired task ──');
  const t5 = await createTaskWithDeadline(yesterday);
  const w5 = await createWorker();
  // Apply will be rejected by expiry check → no submission exists → submit returns 404
  await api(`/tasks/${t5}/apply`, { method: 'POST', headers: auth(w5) });
  const r5 = await api(`/tasks/${t5}/submit`, {
    method: 'POST', headers: auth(w5),
    body: JSON.stringify({ proof: 'Proof text' }),
  });
  await t('Expired task rejects submit (no submission to submit)', () => {
    if (r5.status === 404) return;
    if (r5.status === 400 && r5.body.message?.toLowerCase().includes('expir')) return;
    throw new Error(`Expected 400/404, got ${r5.status}: ${r5.body.message}`);
  });

  // ── Test 6: Expired task hidden from OPEN listing ──
  console.log('\n── Test 6: Expired task not in OPEN listing ──');
  const t6 = await createTaskWithDeadline(yesterday);
  const r6 = await api('/tasks?status=OPEN&limit=50');
  const tasks = r6.body.data || [];
  const found = tasks.find(t => t.id === t6);
  await t('Expired task excluded from OPEN listing', () => {
    if (found) throw new Error('Expired task found in OPEN listing');
  });

  console.log(`\n═══ Results: ${pass} passed, ${fail} failed ═══`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
