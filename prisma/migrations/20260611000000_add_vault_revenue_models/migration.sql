-- Add PAY to WalletCurrency enum
ALTER TYPE "WalletCurrency" ADD VALUE IF NOT EXISTS 'PAY';

-- VaultPool: tracks the revenue pool
CREATE TABLE IF NOT EXISTS "vault_pool" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "total_ngn" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "total_pay" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "last_distribution_at" TIMESTAMPTZ,
  "next_distribution_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- VaultDistribution: each distribution event
CREATE TABLE IF NOT EXISTS "vault_distributions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pool_id" UUID NOT NULL REFERENCES "vault_pool"("id") ON DELETE CASCADE,
  "total_ngn" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "total_pay" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "eligible_count" INTEGER NOT NULL DEFAULT 0,
  "total_pay_weight" DECIMAL(30,8) NOT NULL DEFAULT 0,
  "distributed_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_distributions_distributed_at ON "vault_distributions"("distributed_at");

-- VaultPayout: each user's payout from a distribution
CREATE TABLE IF NOT EXISTS "vault_payouts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distribution_id" UUID NOT NULL REFERENCES "vault_distributions"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pay_holding" DECIMAL(30,8) NOT NULL DEFAULT 0,
  "pay_weight" DECIMAL(30,8) NOT NULL DEFAULT 0,
  "share_ngn" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "share_pay" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_payouts_user ON "vault_payouts"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS idx_vault_payouts_distribution ON "vault_payouts"("distribution_id");

-- VaultUserStats: cached user vault stats
CREATE TABLE IF NOT EXISTS "vault_user_stats" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "total_earned_ngn" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "total_earned_pay" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "distributions_received" INTEGER NOT NULL DEFAULT 0,
  "pay_balance" DECIMAL(30,8) NOT NULL DEFAULT 0,
  "is_eligible" BOOLEAN NOT NULL DEFAULT false,
  "last_active_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- VaultRevenueLog: revenue sources feeding the pool
CREATE TABLE IF NOT EXISTS "vault_revenue_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" TEXT NOT NULL,
  "source_id" TEXT,
  "amount_ngn" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "amount_pay" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "description" TEXT,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vault_revenue_log_recorded_at ON "vault_revenue_log"("recorded_at");

-- Seed initial vault pool
INSERT INTO "vault_pool" ("total_ngn", "total_pay")
VALUES (0, 0)
ON CONFLICT DO NOTHING;
