#!/bin/bash
# Vault Setup Script — Run after deployment
# This script seeds the initial vault pool and gives $PAY tokens to active users

echo "🔧 Vault Setup"
echo "=============="

# 1. Run Prisma migration
echo ""
echo "📦 Running Prisma migration..."
npx prisma migrate deploy
echo "✅ Migration complete"

# 2. Seed initial vault pool
echo ""
echo "🏦 Seeding initial vault pool..."
psql "$DATABASE_URL" -c "INSERT INTO vault_pool (total_ngn, total_pay) VALUES (0, 0) ON CONFLICT DO NOTHING;" 2>/dev/null
echo "✅ Pool ready"

# 3. Seed $PAY tokens
echo ""
echo "🌱 Seeding $PAY tokens to active users..."
node scripts/seed-pay-tokens.js
echo "✅ $PAY tokens seeded"

# 4. Check distribution schedule
echo ""
echo "⏰ Distribution schedule: daily at midnight UTC"
echo ""

echo "🎉 Vault setup complete!"
echo ""
echo "Next steps:"
echo "  - Run 'node scripts/seed-pay-tokens.js' to give more users $PAY"
echo "  - Add revenue: POST /api/v1/vault/admin/add-revenue"
echo "  - Test distribution: POST /api/v1/vault/admin/distribute"
echo "  - View pool: GET /api/v1/vault"
