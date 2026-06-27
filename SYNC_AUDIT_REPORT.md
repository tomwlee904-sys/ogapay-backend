# SYNC AUDIT REPORT

**Date:** 2026-06-26
**Scope:** All frontend pages in `ogapay-backend/src/pages/`
**Methodology:** Traced every data source, API call, localStorage read/write, and cross-page sync point.

---

## ⚠️ OVERARCHING FINDING

The `app/` frontend directory **does not exist** on disk. All pages reside in `ogapay-backend/src/pages/`. The codebase has been substantially rewritten since the prior analysis.

**AuthContext** (`ogapay-backend/src/context/AuthContext.tsx`) is minimal — it only tracks `isAuthed` via localStorage key `ogapay-authenticated`. There is **no user object, no token storage, no `/auth/me` fetch, no refresh logic** in AuthContext. It exports `login()` / `logout()` that just toggle the boolean.

**Settings.tsx** is the **only page** that makes real API calls, using its own direct `fetch()` + manually reading tokens from `localStorage.getItem('token')` or `sessionStorage.getItem('token')`.

All other pages use **hardcoded mock data** — zero API calls, zero localStorage reads/writes for business data, zero cross-page sync concerns because there is nothing to sync.

---

## PAGE-BY-PAGE AUDIT

### 1. Login / Auth
- **File:** No `LoginPage.tsx` exists. Login forms are in `public/login.html` and `public/login_backup.html`.
- **AuthContext:** `ogapay-backend/src/context/AuthContext.tsx:16-18` — reads `ogapay-authenticated` from localStorage on init.
- **BREAK:** AuthContext stores NO user object, NO tokens, NO wallet data after login. The `login()` function at line 24-27 just sets `isAuthed = true`. There is no `/auth/me` call anywhere in AuthContext. Settings.tsx reads tokens directly from `localStorage.getItem('token')` — **two parallel auth sources** that can diverge.

### 2. Dashboard (`Dashboard.tsx`)
- **Data source:** All hardcoded (`earnings`, `graphData`, `activeTasks`, `pendingTasks`, `recommended`, `recentActivity`, `announcements`, `communityUpdates` at lines 5-50).
- **API calls:** NONE.
- **Wallet balance:** Line 160 — `NGN {earnings.available.toLocaleString()}.00` reads hardcoded `earnings.available` (value: `12450`).
- **BREAK:** Entire Dashboard is static mock data. No data is fetched from any backend. No sync possible because nothing is real.

### 3. Profile (`Profile.tsx`)
- **Data source:** All hardcoded — `NGN 12,450.00` at line 97, `User Name` / `@username` / `Gold Tier` / `4.8 Rep` / `Verified` at lines 113-119.
- **Referral link:** `https://ogapay.app/ref/your-code` at line 135 — hardcoded placeholder.
- **API calls:** NONE.
- **BREAK:** No user data is fetched from API. No bank accounts, no KYC status, no real balance. No sync with Settings or any other page.

### 4. Wallet (`Wallet.tsx`)
- **Data source:** All hardcoded — `NGN 12,450.00` at line 62, `$8.42 USDC · 0.045 SOL` at line 63, `transactions` array at lines 4-10.
- **API calls:** NONE — no `GET /wallet/balance`, no transaction history fetch.
- **localStorage:** Not accessed.
- **BREAK:** Wallet balance is static text. Withdrawal, deposit, transfer buttons at lines 66-68 are `<a href="#">` with no handlers. No real transaction history.

### 5. Vault (`Vault.tsx`)
- **Data source:** All hardcoded — `documents` array at lines 5-10, `stats` at lines 12-16.
- **API calls:** NONE — does NOT call `/auth/me` (contrary to prior analysis). 
- **BREAK:** No document upload/retrieval. No real storage usage tracking. Upload button at line 78 has no handler.

### 6. Tasks (`Tasks.tsx`)
- **Data source:** All hardcoded — `allTasks` array at lines 4-17, `categories` at line 19.
- **API calls:** NONE.
- **localStorage:** Not accessed.
- **BREAK:** No task listing from backend. "Apply" button at line 110-114 just adds to local `applied` state array (lost on page refresh). No actual task application API call.

### 7. My Tasks (`MyTasks.tsx`)
- **Data source:** All hardcoded — `myTasks` array at lines 15-20, `statusColors` at lines 22-27.
- **API calls:** NONE.
- **BREAK:** No submitted tasks fetched from API. No actual task status tracking. Does not sync with Tasks page (which uses separate hardcoded data).

### 8. Store / Marketplace (`Store.tsx`)
- **Data source:** All hardcoded — `categories` at lines 4-14, `products` at lines 16-26.
- **API calls:** NONE.
- **BREAK:** No real product listings. "View Details" button at line 153 has no handler. No purchase flow.

### 9. My Store (`MyStore.tsx`)
- **Data source:** All hardcoded — `products` at lines 4-8.
- **API calls:** NONE.
- **BREAK:** No real products, sales, or orders. Stats show `'NGN 0'` for sales at line 58 and `'25'` for orders at line 59 — hardcoded placeholders.

### 10. Worker Portal (`WorkerPortal.tsx`)
- **Data source:** All hardcoded — `quickLinks` at lines 3-13, `stats` at lines 15-23.
- **API calls:** NONE.
- **BREAK:** Worker name shows `User Name` at line 85, bio shows `Freelancer & task worker on OgaPay` at line 86 — hardcoded. Stats (`124 Reviews`, `8 Challenges`, etc.) are hardcoded placeholders.

### 11. Other Pages (Earnings, Referrals, Leaderboard, Messages, Notifications, Communities, Campaigns, Support, FAQ, Settings)
- **Settings** (`Settings.tsx`) is the **only page** with real API integration (lines 247, 287, 314, 344, 368, 389). Uses `fetch()` directly with `https://ogapay-production.up.railway.app/api/v1` base URL. Reads token from `localStorage.getItem('token')` or `sessionStorage.getItem('token')` at line 8.
- All others: **hardcoded mock data**, no API calls.

---

## SUMMARY OF BREAKS

| # | Issue | Severity | File(s) | Details |
|---|-------|----------|---------|---------|
| 1 | **All pages except Settings use hardcoded data** | **CRITICAL** | Dashboard, Profile, Wallet, Vault, Tasks, MyTasks, Store, MyStore, WorkerPortal, Earnings, Referrals, Leaderboard, Messages, Notifications, Communities, Campaigns, Support, FAQ | Zero real data fetched from backend |
| 2 | **AuthContext stores no user object** | **CRITICAL** | `AuthContext.tsx` only tracks `isAuthed` boolean | No user profile, wallet, or token in context |
| 3 | **No cross-page sync possible** | **CRITICAL** | All pages | No shared data layer; each page has isolated hardcoded data |
| 4 | **Token read is ad-hoc in Settings only** | **HIGH** | `Settings.tsx:8` reads `localStorage.getItem('token')` | No centralized token management; other pages can't access auth state |
| 5 | **Wallet has three separate static balances** | **MEDIUM** | Dashboard.tsx:160 (`earnings.available`), Profile.tsx:97 (`NGN 12,450.00`), Wallet.tsx:62 (`NGN 12,450.00`) | Values are hardcoded independently, not synced |
| 6 | **Task "Apply" state is ephemeral** | **MEDIUM** | `Tasks.tsx:112-114` uses local React state | Lost on page refresh; no API call to persist |
| 7 | **Settings is the only page with mutation API calls** | **HIGH** | Settings.tsx (profile update, preferences, password, delete account) | No other page can persist any user action |
| 8 | **No withdrawal/deposit/transfer functionality** | **HIGH** | Wallet.tsx:66-68 buttons are `<a href="#">` with no handlers | Wallet actions are non-functional placeholders |

---

## BETA READINESS: ❌ NOT READY

**The frontend is a static UI prototype.** Only Settings.tsx connects to a real backend. Every other page displays hardcoded placeholder data. The app lacks:

- Real user authentication flow with token management
- Wallet balance fetching and display
- Task listing, application, and status tracking
- Product marketplace with purchase flow
- Worker profile with real stats
- Document vault with upload/retrieve
- Any form of cross-page data sync

**Recommendation:** The frontend needs a full API integration pass before it can be considered beta-ready. The backend (`wallet.routes.js`, `flutterwave.service.js`, etc.) appears functional — the frontend simply never calls it.
