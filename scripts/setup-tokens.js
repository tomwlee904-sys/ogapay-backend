'use strict';
const BASE = 'https://ogapay.app/api/v1';

async function setup() {
  // Register fresh poster
  const r = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `post${Date.now()}@mailtest.xyz`, password: 'Strong!Pass1',
      firstName: 'Post', lastName: 'Audit', username: `post${Date.now()}`, role: 'POSTER',
    }),
  });
  const d = await r.json();
  console.log('POSTER_TOKEN=' + d.data.tokens.accessToken);
  console.log('POSTER_EMAIL=' + d.data.user.email);

  // Credit them
  await fetch(`${BASE}/wallets/credit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: d.data.user.email, amount: 50000, currency: 'NGN' }),
  });

  // Register fresh worker
  const r2 = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `wrk${Date.now()}@mailtest.xyz`, password: 'Strong!Pass1',
      firstName: 'Wrk', lastName: 'Audit', username: `wrk${Date.now()}`, role: 'WORKER',
    }),
  });
  const d2 = await r2.json();
  console.log('WORKER_TOKEN=' + d2.data.tokens.accessToken);
  console.log('WORKER_EMAIL=' + d2.data.user.email);
}
setup().catch(e => console.error(e));
