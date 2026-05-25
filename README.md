# OgaPay Backend API

> One Platform, Equal Opportunities — Node.js + Express + PostgreSQL (Supabase)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | JWT + Supabase Auth |
| KYC | Dojah (Nigeria — NIN/BVN) |
| Payments | Paystack + Flutterwave |
| Storage | Supabase Storage |
| Logging | Winston |
| Validation | Zod |

## Project Structure

```
ogapay-backend/
├── src/
│   ├── index.js              # Express app + server
│   ├── config/
│   │   ├── database.js       # Prisma client singleton
│   │   └── supabase.js       # Supabase public + admin clients
│   ├── middleware/
│   │   ├── auth.middleware.js # JWT auth, role checks, KYC guard
│   │   ├── validate.js        # Zod validation schemas
│   │   ├── errorHandler.js    # Global error handler
│   │   └── notFound.js        # 404 handler
│   ├── routes/
│   │   ├── auth.routes.js     # Register, login, refresh, logout
│   │   ├── user.routes.js     # Profile, avatar, transactions
│   │   ├── wallet.routes.js   # Balances, deposit, withdraw
│   │   ├── task.routes.js     # Create, list, apply, submit, review
│   │   ├── kyc.routes.js      # Submit, upload docs, admin review
│   │   ├── leaderboard.routes.js
│   │   ├── store.routes.js
│   │   ├── notification.routes.js
│   │   └── webhook.routes.js  # Paystack + Flutterwave webhooks
│   ├── services/
│   │   ├── auth.service.js    # Register, login, token logic
│   │   ├── user.service.js    # Profile management
│   │   ├── wallet.service.js  # Balances, escrow, payments
│   │   ├── task.service.js    # Full task lifecycle
│   │   └── kyc.service.js     # Dojah integration, admin review
│   └── utils/
│       ├── apiResponse.js     # ApiError class + response helpers
│       ├── jwt.js             # Token signing + verification
│       └── logger.js          # Winston logger
├── prisma/
│   ├── schema.prisma          # Full DB schema (14 models)
│   └── seed.js                # Demo data
└── docs/
    └── API.md                 # Full API reference
```

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in your Supabase, Paystack, Dojah credentials
```

### 3. Set up the database
```bash
# Generate Prisma client
npm run generate

# Run migrations (creates all tables)
npm run migrate

# Seed demo data
npm run seed
```

### 4. Start the server
```bash
npm run dev      # Development (hot reload)
npm start        # Production
```

The API will be running at `http://localhost:5000/api/v1`

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** for your `DATABASE_URL`
3. Go to **Settings → API** for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
4. Create Storage buckets:
   - `kyc-documents` (private)
   - `public-assets` (public)

## Paystack Setup

1. Sign up at [paystack.com](https://paystack.com)
2. Get your **Secret Key** and **Public Key** from the dashboard
3. Set your webhook URL to: `https://api.ogapay.io/api/v1/webhooks/paystack`

## Dojah KYC Setup

1. Sign up at [dojah.io](https://dojah.io)
2. Create an app and get your **App ID** and **Secret Key**
3. Enable: BVN lookup, NIN lookup, ID verification

## Deployment (Railway / Render / VPS)

```bash
# Set NODE_ENV=production in your hosting environment
npm run migrate:deploy   # Run migrations in production
npm start
```

## Demo Credentials (after seed)

| Role | Email | Password |
|------|-------|---------|
| Admin | admin@ogapay.io | Admin@ogapay123 |
| Worker | chidi@example.com | Worker@123 |
| Poster | amaka@startup.ng | Poster@123 |

## Next Modules to Build

- [ ] **Dispute resolution** — mediation flow when workers/posters disagree
- [ ] **Referral rewards** — auto-credit on referral's first earning
- [ ] **Push notifications** — Firebase FCM for mobile
- [ ] **Email service** — Resend/SendGrid for verification + receipts
- [ ] **Job queues** — BullMQ + Redis for async withdrawals, crypto confirmations
- [ ] **Admin dashboard** — Analytics, user management, task moderation
- [ ] **Crypto wallet generation** — per-user wallet addresses via Alchemy
