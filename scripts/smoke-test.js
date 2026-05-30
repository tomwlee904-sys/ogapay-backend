'use strict';

const BASE_URL = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api/${process.env.API_VERSION || 'v1'}`;
const POSTER_EMAIL = process.env.SMOKE_POSTER_EMAIL || 'amaka@startup.ng';
const POSTER_PASSWORD = process.env.SMOKE_POSTER_PASSWORD || 'Poster@123';
const WORKER_EMAIL = process.env.SMOKE_WORKER_EMAIL || 'chidi@example.com';
const WORKER_PASSWORD = process.env.SMOKE_WORKER_PASSWORD || 'Worker@123';

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.message || res.statusText;
    throw new Error(`${options.method || 'GET'} ${path} failed (${res.status}): ${message}`);
  }
  return body;
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

async function main() {
  console.log(`Smoke testing ${BASE_URL}`);

  const posterLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: POSTER_EMAIL, password: POSTER_PASSWORD }),
  });
  const posterToken = posterLogin.data.tokens.accessToken;
  console.log('OK poster login');

  const workerLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: WORKER_EMAIL, password: WORKER_PASSWORD }),
  });
  const workerToken = workerLogin.data.tokens.accessToken;
  console.log('OK worker login');

  await request('/wallets/balance', { headers: authHeader(posterToken) });
  await request('/wallets/balance', { headers: authHeader(workerToken) });
  console.log('OK wallet balances');

  const taskPayload = {
    title: `Smoke Test Task ${Date.now()}`,
    description: 'This is a smoke-test task used to verify task creation and submission flow locally.',
    category: 'OTHER',
    reward: 100,
    currency: 'NGN',
    maxWorkers: 1,
    instructions: 'Submit a short proof text.',
    proofRequired: 'Text proof',
    tags: ['smoke'],
    estimatedTime: 5,
  };

  const created = await request('/tasks', {
    method: 'POST',
    headers: authHeader(posterToken),
    body: JSON.stringify(taskPayload),
  });
  const taskId = created.data.id;
  console.log(`OK task creation: ${taskId}`);

  const applied = await request(`/tasks/${taskId}/apply`, {
    method: 'POST',
    headers: authHeader(workerToken),
  });
  const submissionId = applied.data.id;
  console.log(`OK task apply: ${submissionId}`);

  await request(`/tasks/${taskId}/submit`, {
    method: 'POST',
    headers: authHeader(workerToken),
    body: JSON.stringify({ proof: 'Smoke test proof', workerNotes: 'Completed by smoke test.' }),
  });
  console.log('OK task submission');

  await request(`/tasks/submissions/${submissionId}/review`, {
    method: 'PATCH',
    headers: authHeader(posterToken),
    body: JSON.stringify({ status: 'APPROVED', rating: 5, feedback: 'Smoke test approved.' }),
  });
  console.log('OK submission review and wallet payout');

  await request('/wallets/balance', { headers: authHeader(posterToken) });
  await request('/wallets/balance', { headers: authHeader(workerToken) });
  console.log('OK final wallet balances');

  console.log('Smoke test passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
