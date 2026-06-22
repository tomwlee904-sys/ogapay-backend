'use strict';

// Regression test for GET /api/v1/users/:username 500 bug
// Root cause: route called userService.getWorkerPublicProfile() but
// the service only exported getPublicProfile().
// Fix: route now calls userService.getPublicProfile()

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} — ${detail || 'assertion failed'}`);
    failed++;
  }
}

// 1. Route file calls the correct function name
const routeSrc = fs.readFileSync(path.resolve(__dirname, '../src/routes/user.routes.js'), 'utf8');
const routeMatch = routeSrc.match(/userService\.(\w+)\(req\.params\.username\)/);
assert(
  'Route calls userService.getPublicProfile',
  routeMatch && routeMatch[1] === 'getPublicProfile',
  `Found: userService.${routeMatch?.[1]}`
);

// 2. Service exports getPublicProfile
const serviceSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/user.service.js'), 'utf8');
assert(
  'Service module exports getPublicProfile',
  /getPublicProfile/.test(serviceSrc),
  'getPublicProfile not found in exports'
);

// 3. Route is NOT calling getWorkerPublicProfile anymore
assert(
  'Route does NOT call getWorkerPublicProfile',
  !/getWorkerPublicProfile/.test(routeSrc),
  'Found stale getWorkerPublicProfile reference'
);

// 4. getPublicProfile uses findUnique with include (not restrictive select)
assert(
  'getPublicProfile uses findUnique with include',
  /\bfindUnique\b[\s\S]*?include:/.test(serviceSrc),
  'getPublicProfile does not use include'
);

// 5. getPublicProfile strips passwordHash
assert(
  'getPublicProfile strips passwordHash',
  /passwordHash/.test(serviceSrc.match(/const\s*\{[^}]*passwordHash[^}]*\}\s*=\s*user/)?.[0] || ''),
  'passwordHash not destructured out'
);

// 6. getPublicProfile includes wallets, kyc, workerProfile, posterProfile, _count
const getPublicFn = serviceSrc.match(/const getPublicProfile[\s\S]*?^\};/m)?.[0] || '';
assert(
  'getPublicProfile includes wallets',
  /wallets/.test(getPublicFn),
  'wallets not included'
);
assert(
  'getPublicProfile includes kyc',
  /kyc/.test(getPublicFn),
  'kyc not included'
);
assert(
  'getPublicProfile includes workerProfile',
  /workerProfile/.test(getPublicFn),
  'workerProfile not included'
);
assert(
  'getPublicProfile includes posterProfile',
  /posterProfile/.test(getPublicFn),
  'posterProfile not included'
);
assert(
  'getPublicProfile includes _count',
  /_count/.test(getPublicFn),
  '_count not included'
);

// Results
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
