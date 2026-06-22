const BASE = 'https://ogapay.app/api/v1';

async function main() {
  // Try funding via credit
  console.log('=== Credit wallet ===');
  let r = await fetch(`${BASE}/wallets/credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 't1782155283895@mailtest.xyz', amount: 1000, currency: 'NGN' }),
  });
  let b = await r.json();
  console.log(r.status, JSON.stringify(b));

  // If credit doesn't work, try the deposit route with auth
  console.log('\n=== Check balance ===');
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MTcyM2JkMi01ZGE1LTRjNjItYmQwOC0zMjRjNGMyNzBiMjEiLCJlbWFpbCI6InQxNzgyMTU1MjgzODk1QG1haWx0ZXN0Lnh5eiIsInJvbGUiOiJQT1NURVIiLCJpYXQiOjE3ODIxNTUyODYsImV4cCI6MTc4Mjc2MDA4Nn0.NNfGrR94HFg6VnAdh0KRmylB5EmjyyASq-XyJUN5378';
  r = await fetch(`${BASE}/wallets/balance`, { headers: { Authorization: `Bearer ${token}` } });
  b = await r.json();
  console.log(r.status, JSON.stringify(b.data?.NGN));
}

main().catch(e => console.error(e));
