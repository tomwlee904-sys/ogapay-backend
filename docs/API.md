# OgaPay Backend API Documentation

**Base URL:** `https://api.ogapay.io/api/v1`  
**Auth:** `Authorization: Bearer <access_token>`

---

## Authentication

### Register
```
POST /auth/register
```
```json
{
  "firstName": "Chidi",
  "lastName": "Okonkwo",
  "email": "chidi@example.com",
  "password": "Secure@123",
  "username": "chidio",
  "role": "WORKER",          // "WORKER" | "POSTER"
  "referralCode": "OGAXYZ"   // optional
}
```
**Returns:** `{ user, tokens: { accessToken, refreshToken } }`

---

### Login
```
POST /auth/login
```
```json
{ "email": "chidi@example.com", "password": "Secure@123" }
```

---

### Refresh Tokens
```
POST /auth/refresh
```
```json
{ "refreshToken": "<refresh_token>" }
```

---

### Logout
```
POST /auth/logout  [Auth required]
```

---

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/profile` | Get my full profile |
| PATCH | `/users/profile` | Update profile (name, bio, skills, phone) |
| POST | `/users/avatar` | Upload avatar image (multipart) |
| GET | `/users/:username` | Get public worker profile |
| GET | `/users/transactions/history` | My transaction history |
| GET | `/users/referrals/stats` | My referral code & stats |

---

## Wallets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallets` | Get all my wallets (NGN, USDC, USDT) |
| POST | `/wallets/deposit` | Initiate deposit → returns payment URL |
| POST | `/wallets/withdraw` | Withdraw funds (requires KYC) |

### Deposit body
```json
{
  "amount": 5000,
  "currency": "NGN",
  "provider": "PAYSTACK",      // "PAYSTACK" | "FLUTTERWAVE" | "CRYPTO"
  "callbackUrl": "https://ogapay.io/deposit/success"
}
```

### Withdraw body
```json
{
  "amount": 2000,
  "currency": "NGN",
  "bankCode": "044",           // For NGN bank transfer
  "accountNumber": "0123456789"
}
```

---

## Tasks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tasks` | ❌ | List open tasks (filterable) |
| GET | `/tasks/:id` | ❌ | Get task detail |
| POST | `/tasks` | POSTER | Create task (locks funds in escrow) |
| POST | `/tasks/:id/apply` | WORKER | Apply to a task |
| POST | `/tasks/:id/submit` | WORKER | Submit proof (multipart) |
| PATCH | `/tasks/submissions/:id/review` | POSTER | Approve/reject submission |
| GET | `/tasks/my/created` | POSTER | My posted tasks |
| GET | `/tasks/my/submissions` | WORKER | My task submissions |

### Create Task body
```json
{
  "title": "Follow our Instagram",
  "description": "Follow @Brand and comment on latest post",
  "category": "SOCIAL_MEDIA",
  "reward": 200,
  "currency": "NGN",
  "maxWorkers": 50,
  "instructions": "Step by step instructions...",
  "proofRequired": "Screenshot of comment",
  "deadline": "2025-12-31T23:59:59Z",
  "estimatedTime": 5,
  "tags": ["instagram", "social"]
}
```

### Task Categories
`SOCIAL_MEDIA | DATA_ENTRY | CONTENT_WRITING | APP_TESTING | SURVEY | DESIGN | TRANSLATION | WEB_RESEARCH | VIDEO_REVIEW | OTHER`

### Review Submission body
```json
{
  "status": "APPROVED",        // "APPROVED" | "REJECTED"
  "rating": 5,                 // 1-5 stars
  "feedback": "Great work!",
  "posterNotes": "Rejection reason if rejected"
}
```

**On APPROVED:** Payment is auto-released from escrow to the worker's wallet.

---

## KYC Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/kyc/status` | Get my KYC status |
| POST | `/kyc/submit` | Submit KYC data (ID number, type) |
| POST | `/kyc/documents/id_front` | Upload front of ID (multipart) |
| POST | `/kyc/documents/id_back` | Upload back of ID (multipart) |
| POST | `/kyc/documents/selfie` | Upload selfie (multipart) |
| GET | `/kyc/admin/pending` | [ADMIN] List pending KYC |
| PATCH | `/kyc/admin/:userId/review` | [ADMIN] Approve/reject KYC |

### Submit KYC body
```json
{
  "idType": "NIN",             // "NIN" | "BVN" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD"
  "idNumber": "12345678901",
  "dateOfBirth": "1995-06-15T00:00:00Z",
  "address": "5 Lagos Street",
  "city": "Lagos",
  "state": "Lagos"
}
```

**KYC Flow:**
1. User submits ID data → `POST /kyc/submit`
2. Uploads document images → `POST /kyc/documents/*`
3. Admin reviews → `PATCH /kyc/admin/:userId/review`
4. User gets notified of approval/rejection

---

## Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leaderboard/workers` | Ranked worker list |
| GET | `/leaderboard/me` | My rank |
| GET | `/leaderboard/top-earners` | Weekly top earners |

**Query params for `/workers`:** `sortBy=reputationScore|totalEarned|tasksCompleted|avgRating`, `page`, `limit`

---

## Store

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/store` | Browse items |
| POST | `/store/:itemId/purchase` | Buy item (deducts from wallet) |
| POST | `/store/admin/items` | [ADMIN] Create item |
| PATCH | `/store/admin/items/:id` | [ADMIN] Update item |

---

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | My notifications |
| PATCH | `/notifications/:id/read` | Mark one as read |
| PATCH | `/notifications/read-all` | Mark all as read |

---

## Webhooks (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/paystack` | Paystack payment events |
| POST | `/webhooks/flutterwave` | Flutterwave payment events |

Webhook endpoints verify HMAC signatures before processing.

---

## Error Responses

All errors follow:
```json
{
  "success": false,
  "message": "Human-readable error",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation failed |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (wrong role, not KYC'd, banned) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, already applied) |
| 429 | Rate limited |
| 500 | Server error |

---

## Worker Level System

| Level | Requirements |
|-------|-------------|
| BEGINNER | Just registered |
| INTERMEDIATE | 10+ tasks |
| ADVANCED | 50+ tasks, 4.0+ rating |
| EXPERT | 200+ tasks, 4.5+ rating |
| LEGEND | 500+ tasks, 4.8+ rating |

---

## Escrow Flow

```
Poster creates task
   → Platform locks (reward × workers) + 10% fee in poster's wallet
   → Task status: OPEN

Worker applies & submits
   → Poster reviews submission

If APPROVED:
   → Platform releases reward to worker wallet
   → Worker profile updated (earnings, level, reputation)

If REJECTED:
   → Worker can revise (if poster allows) or dispute
```

---

## Rate Limits

| Route | Limit |
|-------|-------|
| Auth endpoints | 20 req / 15 min |
| All other endpoints | 200 req / 15 min |
