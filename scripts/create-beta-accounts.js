'use strict';
/**
 * Create beta test accounts directly via Prisma + auth service
 * Usage: node scripts/create-beta-accounts.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

function genReferralCode() {
  return crypto.randomBytes(4).toString('hex').slice(0, 8);
}

const BETA_ACCOUNTS = [
  { firstName: 'Beta', lastName: 'One', email: 'beta1@ogapay.io', password: 'Beta1234', username: 'beta_one' },
  { firstName: 'Beta', lastName: 'Two', email: 'beta2@ogapay.io', password: 'Beta1234', username: 'beta_two' },
  { firstName: 'Beta', lastName: 'Three', email: 'beta3@ogapay.io', password: 'Beta1234', username: 'beta_three' },
  { firstName: 'Beta', lastName: 'Four', email: 'beta4@ogapay.io', password: 'Beta1234', username: 'beta_four' },
  { firstName: 'Beta', lastName: 'Five', email: 'beta5@ogapay.io', password: 'Beta1234', username: 'beta_five' },
];

async function main() {
  console.log('Creating beta accounts...\n');
  for (const acc of BETA_ACCOUNTS) {
    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email: acc.email }, { username: acc.username }] },
      });
      if (existing) {
        console.log(`\u26a0 Skipping ${acc.email} \u2014 already exists as ${existing.username}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(acc.password, 12);
      const user = await prisma.user.create({
        data: {
          email: acc.email,
          firstName: acc.firstName,
          lastName: acc.lastName,
          username: acc.username,
          passwordHash,
          role: 'WORKER',
          referralCode: genReferralCode(),
          isEmailVerified: true,
        },
      });

      // Create wallet
      await prisma.wallet.create({
        data: {
          userId: user.id,
          currency: 'NGN',
          balance: 50000, // Give them some test funds
          isActive: true,
        },
      });

      // Create worker profile
      await prisma.workerProfile.create({
        data: { userId: user.id },
      });

      console.log(`\u2713 Created ${acc.email} / ${acc.password}`);
    } catch (err) {
      console.error(`\u2717 Failed ${acc.email}: ${err.message}`);
    }
  }
  console.log('\nDone. Passwords: Beta1234 for all accounts');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
