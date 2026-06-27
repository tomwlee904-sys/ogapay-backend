'use strict';

/**
 * Backfill Script: Signup Bonus for Already-Verified Users
 *
 * Awards ₦1,000 SIGNUP_BONUS to any user with approved KYC (NIN or BVN, tier ≥ 1)
 * who has not yet received the bonus (signupBonusPaid = false).
 *
 * This applies to ALL users — existing and new, verified before or after this feature ships.
 *
 * Run in two phases:
 *   Phase 1 (dry-run / preview):  node scripts/backfill-signup-bonus.js --preview
 *   Phase 2 (execute):            node scripts/backfill-signup-bonus.js --execute
 *
 * Safe to re-run — idempotent via signupBonusPaid check.
 */

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const SIGNUP_BONUS_AMOUNT = 1000;
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 500;

async function getPendingUsers() {
  return prisma.user.findMany({
    where: {
      signupBonusPaid: false,
      kyc: { status: 'APPROVED', kycTier: { gte: 1 } },
    },
    select: { id: true, email: true, firstName: true, signupBonusPaid: true },
  });
}

async function preview() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  SIGNUP BONUS BACKFILL — PREVIEW');
  console.log('═══════════════════════════════════════════\n');

  const users = await getPendingUsers();
  const totalCost = users.length * SIGNUP_BONUS_AMOUNT;

  console.log(`Users eligible for signup bonus: ${users.length}`);
  console.log(`Bonus per user: ₦${SIGNUP_BONUS_AMOUNT.toLocaleString()}`);
  console.log(`Total cost: ₦${totalCost.toLocaleString()}\n`);

  if (users.length === 0) {
    console.log('No eligible users found. All caught up!');
    return;
  }

  console.log('Sample users (first 5):');
  users.slice(0, 5).forEach(u => {
    console.log(`  • ${u.email} (${u.firstName}) — id: ${u.id}`);
  });

  if (users.length > 5) {
    console.log(`  … and ${users.length - 5} more`);
  }

  console.log(`\nTo execute: node scripts/backfill-signup-bonus.js --execute\n`);
  return users.length;
}

async function execute() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  SIGNUP BONUS BACKFILL — EXECUTION');
  console.log('═══════════════════════════════════════════\n');

  const users = await getPendingUsers();
  const total = users.length;

  if (total === 0) {
    console.log('No eligible users found. All caught up!');
    return;
  }

  console.log(`Processing ${total} users in batches of ${BATCH_SIZE}...\n`);

  let succeeded = 0;
  let failed = 0;
  let totalCost = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} users...`);

    for (const user of batch) {
      try {
        const result = await prisma.$transaction(async (db) => {
          // Re-check inside transaction for idempotency
          const current = await db.user.findUnique({
            where: { id: user.id },
            select: { signupBonusPaid: true },
          });
          if (current?.signupBonusPaid) {
            return { skipped: true, reason: 'already paid' };
          }

          const wallet = await db.wallet.findUnique({
            where: { userId_currency: { userId: user.id, currency: 'NGN' } },
          });
          if (!wallet) {
            return { skipped: true, reason: 'no NGN wallet' };
          }

          const newBalance = parseFloat(wallet.balance) + SIGNUP_BONUS_AMOUNT;
          const reference = `OGA-SGN-${uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase()}`;

          await db.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });

          await db.transaction.create({
            data: {
              userId: user.id,
              walletId: wallet.id,
              type: 'SIGNUP_BONUS',
              status: 'COMPLETED',
              amount: SIGNUP_BONUS_AMOUNT,
              currency: 'NGN',
              reference,
              balanceBefore: wallet.balance,
              balanceAfter: newBalance,
              description: 'Signup bonus (backfill)',
              completedAt: new Date(),
            },
          });

          await db.user.update({
            where: { id: user.id },
            data: { signupBonusPaid: true },
          });

          return { skipped: false, reference, amount: SIGNUP_BONUS_AMOUNT };
        });

        if (result.skipped) {
          failed++;
          console.log(`  ⏭  ${user.email}: ${result.reason}`);
        } else {
          succeeded++;
          totalCost += SIGNUP_BONUS_AMOUNT;
          console.log(`  ✅ ${user.email}: ₦${SIGNUP_BONUS_AMOUNT.toLocaleString()} — ${result.reference}`);
        }
      } catch (err) {
        failed++;
        console.error(`  ❌ ${user.email}: ${err.message}`);
      }
    }

    if (i + BATCH_SIZE < total) {
      console.log(`  → Waiting ${BATCH_DELAY_MS}ms before next batch...\n`);
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  BACKFILL COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Total cost: ₦${totalCost.toLocaleString()}`);
  console.log('═══════════════════════════════════════════\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--preview') || args.length === 0) {
    await preview();
  } else if (args.includes('--execute')) {
    await execute();
  } else {
    console.log('Usage: node scripts/backfill-signup-bonus.js [--preview | --execute]');
    console.log('  --preview  (default) Show count and cost without processing');
    console.log('  --execute  Run the backfill');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
