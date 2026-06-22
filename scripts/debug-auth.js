const BASE = 'https://ogapay.app/api/v1';

async function main() {
  // Test 1: health-like endpoint to check server
  console.log('=== GET /tasks ===');
  let r = await fetch(`${BASE}/tasks?limit=1`);
  console.log(r.status, (await r.json()).success);

  // Test 2: register
  console.log('\n=== POST /auth/register ===');
  const email = `t${Date.now()}@mailtest.xyz`;
  const user = `t_user_${Date.now()}`;
  r = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Strong!Pass1', firstName: 'Test', lastName: 'User', username: user, role: 'POSTER' }),
  });
  const rb = await r.json();
  console.log(r.status, rb);

  // Test 3: login
  console.log('\n=== POST /auth/login ===');
  r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'amaka@startup.ng', password: 'Poster@123' }),
  });
  console.log(r.status, await r.json());
}

main().catch(e => console.error(e));
