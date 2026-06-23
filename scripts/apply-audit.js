'use strict';

const BASE = 'https://ogapay.app/api/v1';
const POSTER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MTcyM2JkMi01ZGE1LTRjNjItYmQwOC0zMjRjNGMyNzBiMjEiLCJlbWFpbCI6InQxNzgyMTU1MjgzODk1QG1haWx0ZXN0Lnh5eiIsInJvbGUiOiJQT1NURVIiLCJpYXQiOjE3ODIxNTUyODYsImV4cCI6MTc4Mjc2MDA4Nn0.NNfGrR94HFg6VnAdh0KRmylB5EmjyyASq-XyJUN5378';

const api = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Fund poster
async function fundPoster() {
  const r = await fetch(`${BASE}/wallets/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 't1782155283895@mailtest.xyz', amount: 10000, currency: 'NGN' }),
  });
  const b = await r.json();
  console.log('  Funded poster:', b.message, b.data?.newBalance);
}

async function createWorker() {
  const r = await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `wk${Date.now()}${Math.random().toString(36).slice(2,5)}@mailtest.xyz`,
      password: 'Strong!Pass1',
      firstName: 'Wkr', lastName: 'Aud',
      username: `wkr${Date.now()}${Math.random().toString(36).slice(2,8)}`,
      role: 'WORKER',
    }),
  });
  if (!r.ok) throw new Error(`Create worker: ${r.body.message}`);
  return { id: r.body.data.user.id, token: r.body.data.tokens.accessToken };
}

async function createTask(maxWorkers, reward = 50) {
  const r = await api('/tasks', {
    method: 'POST', headers: auth(POSTER_TOKEN),
    body: JSON.stringify({
      title: `AUDIT ${Date.now()}`,
      description: 'Audit task for application concurrency testing on OgaPay platform',
      category: 'OTHER', reward, currency: 'NGN', maxWorkers,
      instructions: 'Submit proof text', proofRequired: 'Text',
      tags: ['audit'], estimatedTime: 5,
    }),
  });
  if (!r.ok) throw new Error(`Create task: ${r.body.message}`);
  return r.body.data.id;
}

function workerApply(workerToken, taskId) {
  return api(`/tasks/${taskId}/apply`, { method: 'POST', headers: auth(workerToken) });
}

async function getTask(taskId) {
  const r = await api(`/tasks/${taskId}`, { headers: auth(POSTER_TOKEN) });
  return r.body.data?.task || r.body.data;
}

async function main() {
  console.log('═══ APPLY TO TASK — CONCURRENCY AUDIT ═══\n');
  await fundPoster();

  // ── Test 1: Same worker, sequential duplicates ──
  console.log('\n── Test 1: Same worker, sequential duplicates ──');
  const w1 = await createWorker();
  const t1 = await createTask(5);
  const r1a = await workerApply(w1.token, t1);
  const r1b = await workerApply(w1.token, t1);
  console.log(`  1st: ${r1a.status} ${r1a.body.message || ''}`);
  console.log(`  2nd: ${r1b.status} ${r1b.body.message || ''}`);
  console.log(`  => ${r1a.ok && r1b.status === 409 ? 'PASS' : 'FAIL'}`);

  // ── Test 2: Same worker, 10 concurrent ──
  console.log('\n── Test 2: Same worker, 10 concurrent applies ──');
  const w2 = await createWorker();
  const t2 = await createTask(5);
  const t2r = await Promise.allSettled(
    Array.from({ length: 10 }, () => workerApply(w2.token, t2))
  );
  const t2s = t2r.map(r => r.status === 'fulfilled' ? r.value.status : 0);
  console.log(`  201×${t2s.filter(c => c === 201).length}  409×${t2s.filter(c => c === 409).length}  other:${t2s.filter(c => c !== 201 && c !== 409).join(',') || 'none'}`);

  // ── Test 3: 10 workers, maxWorkers=3 (capacity race) ──
  console.log('\n── Test 3: 10 workers apply to maxWorkers=3 task ──');
  const t3 = await createTask(3, 50);
  const w3 = await Promise.all(Array.from({ length: 10 }, () => createWorker().then(w => w.token)));
  const t3r = await Promise.allSettled(w3.map(t => workerApply(t, t3)));
  const t3s = t3r.map(r => r.status === 'fulfilled' ? r.value.status : 0);
  const t3ok = t3s.filter(c => c === 201).length;
  await new Promise(r => setTimeout(r, 500));
  const t3task = await getTask(t3);
  const cw = t3task?.currentWorkers || 0;
  console.log(`  201×${t3ok}  errors:${t3s.filter(c => c !== 201).join(',')}`);
  console.log(`  currentWorkers: ${cw} / maxWorkers: 3`);
  console.log(`  => ${cw <= 3 ? 'PASS' : `FAIL overfilled by ${cw - 3}`}`);

  // ── Test 4: Poster self-apply ──
  console.log('\n── Test 4: Poster applies to own task ──');
  const t4 = await createTask(3);
  const r4 = await api(`/tasks/${t4}/apply`, { method: 'POST', headers: auth(POSTER_TOKEN) });
  console.log(`  ${r4.status} ${r4.body.message || ''}`);
  console.log(`  => ${r4.status === 400 ? 'PASS' : 'FAIL'}`);

  // ── Test 5: Apply to closed task ──
  console.log('\n── Test 5: Apply to non-OPEN task ──');
  const w5 = await createWorker();
  const r5 = await workerApply(w5.token, '00000000-0000-0000-0000-000000000000');
  console.log(`  ${r5.status} ${r5.body.message || ''}`);
  console.log(`  => ${r5.status === 404 ? 'PASS' : 'FAIL'}`);

  console.log('\n═══ DONE ═══');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
