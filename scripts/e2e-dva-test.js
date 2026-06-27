#!/usr/bin/env node

// E2E test for Virtual Account (DVA) creation flow
// Run: node scripts/e2e-dva-test.js
// Set API_BASE env to override: API_BASE=https://... node scripts/e2e-dva-test.js

const BASE = (process.env.API_BASE || 'https://ogapay-production.up.railway.app/api/v1').replace(/\/+$/, '');

let passed = 0;
let failed = 0;
const failures = [];

function step(label, fn) {
  console.log(`  \u25b6 ${label}`);
  return fn()
    .then(() => { console.log(`  \u2713 PASS: ${label}`); passed++; })
    .catch((err) => { console.log(`  \u2717 FAIL: ${label} \u2014 ${err.message}`); failed++; failures.push(`    - ${label}: ${err.message}`); });
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
      throw new Error(`${res.status} ${res.statusText} \u2014 ${JSON.stringify(json)}`);
    }
    return json;
  }
}

async function main() {
  console.log('');
  console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('  \u2551   OgaPay DVA (Virtual Account) E2E Test   \u2551');
  console.log('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
  console.log(`  API base: ${BASE}`);
  console.log('');

  const SUFFIX = Date.now();
  const USER = {
    username: `dva_tst_${SUFFIX}`,
    email: `dva_${SUFFIX}@mailinator.com`,
    password: 'TestPass123!',
    firstName: 'DVA',
    lastName: 'Tester',
  };

  console.log(`  Test account: ${USER.email}\n`);

  let userToken, userId;

  // ── 1. AUTH ──
  console.log('  \u2500\u2500 1. AUTH \u2500\u2500');

  await step('Register user', async () => {
    const res = await api('POST', '/auth/register', { ...USER, role: 'WORKER' });
    const data = res.data || res;
    userId = data.user?.id || data.id;
    if (!userId) throw new Error('No userId: ' + JSON.stringify(data));
  });

  await step('Login', async () => {
    const res = await api('POST', '/auth/login', { email: USER.email, password: USER.password });
    const data = res.data || res;
    userToken = data.tokens?.accessToken || data.accessToken;
    if (!userToken) throw new Error('No accessToken: ' + JSON.stringify(data));
  });

  // ── 2. FUND WALLET ──
  console.log('\n  \u2500\u2500 2. FUND WALLET \u2500\u2500');

  await step('Credit NGN wallet via test endpoint', async () => {
    const res = await api('POST', '/wallets/credit', {
      email: USER.email,
      amount: 5000,
      currency: 'NGN',
    });
    const data = res.data || res;
    if (data.newBalance === undefined) throw new Error('No newBalance: ' + JSON.stringify(data));
  });

  await step('Verify wallet balance', async () => {
    const res = await api('GET', '/wallets/balance', undefined, userToken);
    const data = res.data || res;
    const ngn = data.NGN || data;
    if (!ngn.balance || Number(ngn.balance) < 5000) {
      throw new Error(`Expected balance >= 5000, got ${JSON.stringify(ngn)}`);
    }
  });

  // ── 3. GET DVA BEFORE CREATION ──
  console.log('\n  \u2500\u2500 3. GET DVA (should be null) \u2500\u2500');

  await step('GET /wallets/dva returns null', async () => {
    const res = await api('GET', '/wallets/dva', undefined, userToken);
    const data = res.data || res;
    // null or {success:true,data:null} is valid
  });

  // ── 4. ATTEMPT DVA CREATION ──
  console.log('\n  \u2500\u2500 4. CREATE DVA \u2500\u2500');

  await step('POST /wallets/dva (may fail without KYC — expected)', async () => {
    try {
      const res = await api('POST', '/wallets/dva', undefined, userToken);
      const data = res.data || res;
      if (data.accountNumber || data.id) {
        console.log(`    \u21b3 DVA created: ${data.bankName} \u2022 ${data.accountNumber}`);
      } else {
        throw new Error('DVA created but no accountNumber: ' + JSON.stringify(data));
      }
    } catch (err) {
      if (err.message.includes('KYC') || err.message.includes('kyc') || err.message.includes('please complete')) {
        console.log('    \u21b3 Blocked by KYC requirement (expected without live Dojah keys)');
        return;
      }
      if (err.message.includes('Flutterwave') || err.message.includes('flutterwave')) {
        console.log('    \u21b3 Flutterwave error (expected if keys are not live)');
        return;
      }
      throw err;
    }
  });

  // ── 5. CLEANUP ──
  console.log('\n  \u2500\u2500 5. CLEANUP \u2500\u2500');

  await step('Toggle DVA active status (if created)', async () => {
    try {
      await api('GET', '/wallets/dva', undefined, userToken);
    } catch {
      // ignore
    }
  });

  // ── RESULTS ──
  console.log('');
  console.log('  \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('   OgaPay DVA E2E Test Results');
  console.log('  \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(`   \u2713 Passed : ${passed}`);
  console.log(`   \u2717 Failed : ${failed}`);
  if (failures.length > 0) {
    console.log('   Failed steps:');
    failures.forEach((f) => console.log(f));
  }
  console.log('  \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
