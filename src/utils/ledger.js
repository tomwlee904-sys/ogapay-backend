'use strict';

/*
 * Guarded wallet movements.
 *
 * Each helper is a single UPDATE whose WHERE clause re-checks the funds, so two
 * requests arriving at the same moment can never both spend the same money
 * (a read-then-write check can't promise that). Amounts are passed as strings
 * and cast to numeric so no float rounding reaches the Decimal columns.
 *
 * Wallet model: balance is everything the user owns, lockedBalance is the part
 * held in escrow or for a pending withdrawal, available = balance - locked.
 */

const num = (v) => String(Number(v));

// Take `spend` out of the wallet and move `hold` into the locked part, only if
// the available balance covers both. Returns true when applied.
const spendAndHold = async (db, walletId, spend, hold) => (await db.$executeRaw`
  UPDATE wallets
     SET balance = balance - ${num(spend)}::numeric,
         locked_balance = locked_balance + ${num(hold)}::numeric,
         updated_at = NOW()
   WHERE id = ${walletId}
     AND balance - locked_balance >= ${num(Number(spend) + Number(hold))}::numeric`) === 1;

// Hold available funds (e.g. a bank withdrawal waiting for the payout).
const holdFunds = (db, walletId, amount) => spendAndHold(db, walletId, 0, amount);

// Spend available funds immediately (e.g. a purchase or an on-chain send).
const debitAvailable = (db, walletId, amount) => spendAndHold(db, walletId, amount, 0);

// Round to the 8 decimals the wallet columns store.
const round8 = (v) => Math.round(Number(v) * 1e8) / 1e8;

module.exports = { spendAndHold, holdFunds, debitAvailable, round8 };
