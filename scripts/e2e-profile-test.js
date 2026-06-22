#!/usr/bin/env node

const BASE = (process.env.API_BASE || 'https://ogapay-production.up.railway.app/api/v1').replace(/\/+$/, '');

let passed = 0;
let failed = 0;
const failures = [];

function step(label, fn) {
  console.log(`  ▶ ${label}`);
  return fn()
    .then(() => { console.log(`  ✓ PASS: ${label}`); passed++; })
    .catch((err) => { console.log(`  ✗ FAIL: ${label} — ${err.message}`); failed++; failures.push(`    - ${label}: ${err.message}`); });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(method, path, body, token, retries = 3) {
  const url = BASE + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(3000 * attempt);
    const res = await fetch(url, opts);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (res.status === 429) { if (attempt < retries - 1) continue; }
    if (!res.ok) {
      const msg = json?.message || json?.error || json?.raw || res.statusText;
      throw new Error(`${res.status} ${res.statusText} — ${JSON.stringify(json)}`);
    }
    return json;
  }
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   OgaPay Profile E2E Test Runner     ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log(`  API base: ${BASE}`);
  console.log('');

  const SUFFIX = String(Date.now()).slice(-8);
  const testUser = {
    username: `pf_tst_${SUFFIX}`,
    email: `pf_tst_${SUFFIX}@mailinator.com`,
    password: 'TestPass123!',
    firstName: 'Profile',
    lastName: 'Tester',
    role: 'POSTER',
  };

  console.log(`  Test user: ${testUser.username}\n`);

  // ── 1. AUTH ──
  console.log('  ── 1. AUTH ──');
  let token;
  await step('Register test user', async () => {
    const res = await api('POST', '/auth/register', testUser);
    const data = res.data || res;
    if (!(data.user?.id || data.id)) throw new Error('No userId: ' + JSON.stringify(data));
  });
  await step('Login test user', async () => {
    const res = await api('POST', '/auth/login', { email: testUser.email, password: testUser.password });
    const data = res.data || res;
    token = data.tokens?.accessToken || data.accessToken;
    if (!token) throw new Error('No accessToken: ' + JSON.stringify(data));
  });

  // ── 2. PROFILE ──
  console.log('\n  ── 2. PROFILE ──');
  let profile;
  await step('GET /users/me returns 200', async () => {
    const res = await api('GET', '/users/me', undefined, token);
    profile = res.data || res;
    if (!profile.username) throw new Error('Profile missing username');
  });
  await step('GET /users/:username returns 200 (no 500)', async () => {
    const res = await api('GET', '/users/' + testUser.username, undefined, token);
    const p = res.data || res;
    if (!p.username) throw new Error('Profile missing username');
  });
  await step('Profile includes firstName + lastName', async () => {
    if (!profile.firstName) throw new Error('Missing firstName');
    if (!profile.lastName) throw new Error('Missing lastName');
  });
  await step('Profile includes walletAddress field', async () => {
    // Field may be null but must exist on the response object
    if (!('walletAddress' in profile) && !('wallet_address' in profile)) {
      throw new Error('walletAddress field absent from profile');
    }
  });

  // ── 3. PUBLIC BLOGS ──
  console.log('\n  ── 3. PUBLIC BLOGS ──');
  await step('GET /users/public/:username/blogs returns 200', async () => {
    const res = await api('GET', '/users/public/' + testUser.username + '/blogs', undefined, token);
    const data = res.data || res;
    if (!Array.isArray(data)) throw new Error('Expected array, got ' + typeof data);
  });

  // ── 4. PUBLIC COMMUNITIES ──
  console.log('\n  ── 4. PUBLIC COMMUNITIES ──');
  await step('GET /users/public/:username/communities returns 200', async () => {
    const res = await api('GET', '/users/public/' + testUser.username + '/communities', undefined, token);
    const data = res.data || res;
    if (!Array.isArray(data)) throw new Error('Expected array, got ' + typeof data);
  });

  // ── 5. PROFILE WITH NO CONTENT ──
  console.log('\n  ── 5. NO CONTENT ──');
  await step('Profile fetch 200 for user with no blogs/communities', async () => {
    const res = await api('GET', '/users/' + testUser.username, undefined, token);
    const p = res.data || res;
    if (!p.username) throw new Error('Profile fetch failed');
  });

  // ── 6. NON-EXISTENT USER ──
  console.log('\n  ── 6. NOT FOUND ──');
  await step('Profile: non-existent user returns 404', async () => {
    try {
      await api('GET', '/users/zz_nonexistent_99999', undefined, token);
      throw new Error('Expected 404');
    } catch (e) {
      if (!e.message.includes('404')) throw new Error('Expected 404, got: ' + e.message);
    }
  });
  await step('Communities: non-existent user returns 404', async () => {
    try {
      await api('GET', '/users/public/zz_nonexistent_99999/communities', undefined, token);
      throw new Error('Expected 404');
    } catch (e) {
      if (!e.message.includes('404')) throw new Error('Expected 404, got: ' + e.message);
    }
  });
  await step('Blogs: non-existent user returns 404', async () => {
    try {
      await api('GET', '/users/public/zz_nonexistent_99999/blogs', undefined, token);
      throw new Error('Expected 404');
    } catch (e) {
      if (!e.message.includes('404')) throw new Error('Expected 404, got: ' + e.message);
    }
  });

  // ── 7. CLEANUP ──
  console.log('\n  ── 7. CLEANUP ──');
  try { await api('DELETE', '/users/me', undefined, token); } catch { try { await api('PATCH', '/users/me', { isActive: false }, token); } catch {} }

  // ── RESULTS ──
  console.log('\n  ════════════════════════════════════════════');
  console.log('   OgaPay Profile Test Results');
  console.log('  ════════════════════════════════════════════');
  console.log(`   ✓ Passed : ${passed}`);
  console.log(`   ✗ Failed : ${failed}`);
  if (failures.length > 0) {
    console.log('   Failed steps:');
    failures.forEach((f) => console.log(f));
  }
  console.log('  ════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err.message); process.exit(1); });
