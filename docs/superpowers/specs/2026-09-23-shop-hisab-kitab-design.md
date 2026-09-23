# Shop Hisab Kitab — v1 Design

## Purpose
Self-hosted, single-shop financial dashboard for tracking daily BharatPe QR collections, cash income, and expenses, with net cash-flow reporting. Not an ERP, not inventory, not a CRM.

## Scope (v1, per owner's final-scope directive)
In:
- One private dashboard page with "Add Income" / "Add Expense" actions
- Daily-grouped and monthly history with filters (date range, type, category, payment method)
- Period summaries: today / this week / this month / last month / this year / custom range / all-time
- Opening balance + income − expenses = closing balance (cash flow, not accounting profit)
- Monthly income/expense trend chart
- Edit and delete transactions (delete requires confirmation, no audit trail in v1)
- Docker Compose deployment: app + MongoDB, two containers only
- BharatPe recorded as a manual daily total; schema carries a `source` field so a future automated import doesn't require a migration

Out (deferred beyond v1, cut from the original broader spec):
- Audit log collection / edit history
- CSV export
- Search over descriptions
- External unique reference dedup field
- Login rate limiting (mitigated by binding the app to 127.0.0.1 only)
- Multi-user accounts / signup flow

## Architecture
Two Docker services on a private bridge network:
- `app`: Next.js (TypeScript, Tailwind, App Router, API routes) — port 3000, bound to `127.0.0.1` only
- `mongodb`: Mongo 7, internal network only, persistent named volume, healthcheck gates app startup

No Redis, no separate backend, no Kubernetes.

```
shop-hisab/
├── docker-compose.yml
├── .env / .env.example
├── .gitignore
└── app/
    ├── Dockerfile, .dockerignore
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx            (dashboard, protected)
    │   │   ├── login/page.tsx
    │   │   ├── layout.tsx
    │   │   ├── middleware.ts       (session gate for pages + APIs)
    │   │   └── api/
    │   │       ├── auth/login, auth/logout
    │   │       ├── transactions/ (route.ts, [id]/route.ts)
    │   │       ├── reports/ (summary/route.ts, trends/route.ts)
    │   │       └── settings/opening-balance/route.ts
    │   ├── components/ (Dashboard, TransactionForm, TransactionHistory, TrendChart, PeriodFilter)
    │   └── lib/ (mongodb.ts, auth.ts, session.ts, money.ts, dates.ts, validation.ts)
    └── tests/ (money.test.ts, dates.test.ts, summary.test.ts)
```

## Data model (MongoDB)

**users** (single admin, seeded at startup from env if absent)
```
{ _id, username, passwordHash, createdAt }
```
Unique index on `username`.

**transactions**
```
{
  _id,
  type: "income" | "expense",
  amountPaise: number,          // integer, no floats
  category: string,             // income: "shop_sales" default; expense: stock|rent|electricity|salary|transport|other
  paymentMethod: "bharatpe" | "cash" | "bank_transfer" | "other",
  source: "manual",             // future: "bharatpe_import" etc., no migration needed
  transactionDate: "YYYY-MM-DD",// shop-local (Asia/Kolkata) calendar date
  description: string,
  createdAt: Date,
  updatedAt: Date
}
```
Indexes: `{ transactionDate: 1 }`, `{ type: 1, transactionDate: 1 }`, `{ paymentMethod: 1 }`, `{ category: 1 }`.

**settings**
```
{ _id: "opening_balance", amountPaise: number, updatedAt: Date }
```

BharatPe settlement transfers into the shop's bank account are never entered separately as income — only the daily BharatPe collection total is recorded, to avoid double-counting.

## Auth
Single fixed admin account, per owner's decision:
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars; on boot, if `users` is empty, hash the password (bcrypt) and insert the one admin user.
- Login issues a stateless signed session cookie (iron-session, `SESSION_SECRET` env var) — HttpOnly, SameSite=Lax, Secure when not on localhost. No server-side session store, so no Redis is needed.
- Next.js middleware protects every page except `/login` and every `/api/*` route except `/api/auth/login`.

## API

| Endpoint | Function |
|---|---|
| POST /api/auth/login | Authenticate, set session cookie |
| POST /api/auth/logout | Clear session |
| POST /api/transactions | Add income or expense |
| GET /api/transactions | Filter (from, to, type, category, paymentMethod) + paginate |
| PATCH /api/transactions/:id | Edit a transaction |
| DELETE /api/transactions/:id | Delete a transaction |
| GET /api/reports/summary?from&to | Totals by type/method/category, opening/closing balance, net cash flow |
| GET /api/reports/trends?months=12 | Monthly income/expense aggregates for the chart |
| GET/PUT /api/settings/opening-balance | Read/set opening balance |

All inputs validated server-side (zod). All finance endpoints require an authenticated session.

## Error handling
- Validation errors → 400 with field-level messages.
- Unauthenticated → 401, middleware redirects page requests to `/login`.
- Not found (edit/delete unknown id) → 404.
- Unexpected DB errors → 500, logged server-side, generic message to client.

## Testing
Lightweight unit tests (vitest), no test DB/containers for v1:
- `money.ts`: paise arithmetic/formatting
- `dates.ts`: period → date-range resolution (today/week/month/last month/year/custom) in Asia/Kolkata
- `reports summary` aggregation logic: opening + income − expenses = closing

## Docker
`docker-compose.yml`, `app/Dockerfile`, `app/.dockerignore`, `.env.example` exactly as specified by the owner: two services, Mongo healthcheck, named volume `mongo_data`, `127.0.0.1:3000:3000` binding, `TZ=Asia/Kolkata`, no Mongo port exposed. README documents startup, shutdown, `mongodump`/`mongorestore` backup/restore, and upgrade steps.
