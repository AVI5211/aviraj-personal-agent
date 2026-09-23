# Aviraj Personal Admin

A private, self-hosted financial command center: consolidated net worth and cash flow across
salary, shop, and personal finances, backed by MongoDB Atlas.

See `docs/superpowers/specs/` for the full design history:
- `2026-09-23-shop-hisab-kitab-design.md` — original shop-only v1
- `2026-09-23-aviraj-personal-admin-phase1-design.md` — current scope and what's deferred

## Modules

- **Overview** (`/`) — consolidated net worth, monthly income/expense, income-by-source, with a
  date filter (today/week/month/last month/year/custom/all-time)
- **Salary** (`/salary`) — monthly gross/deductions/net salary records
- **Shop** (`/shop`) — the original shop hisab-kitab: BharatPe/cash income, expenses, history
- **Personal** (`/personal`) — bank/cash/other-asset/loan account balances for net worth, plus
  personal income/expense tracking
- **Freelance** (`/freelance`) — clients, timesheets, unbilled work, invoices/receivables
  (USD or INR contracts), and lead expenses
- **Loans** (`/loans`) — per-lender repayment schedules: EMIs, paid/pending installments,
  outstanding principal
- **Investments** (`/investments`) — holdings (equity, mutual funds, fixed deposits, savings)
  with a valuation history and gain/loss tracking

Recurring-entry automation (auto-generated monthly salary/PF/EMI), scheduled backups, and an
audit log of financial record edits are deferred — each needs its own design pass before being
built (see `docs/superpowers/specs/2026-09-23-aviraj-personal-admin-phase1-design.md`).

## Stack

- Next.js (App Router, TypeScript, Tailwind CSS) — frontend + API routes in one service
- MongoDB Atlas via the official Node driver — a managed cloud cluster, not a local container
- One Docker Compose service (`app`). No local MongoDB container, no Redis, no separate backend.

## First-time setup

1. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env
   ```

   - `MONGODB_URI` — your MongoDB Atlas connection string (`mongodb+srv://user:pass@cluster/...`)
   - `MONGODB_DB` — the database name to use on that cluster (e.g. `personal`)
   - `SESSION_SECRET` — 32+ random characters, e.g. `openssl rand -base64 32`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — the one login for the dashboard
   - `OPENING_BALANCE_PAISE` — shop's starting cash balance in paise (e.g. `1000000` = ₹10,000.00)
   - `COOKIE_SECURE` — leave `false` unless the app is reachable over HTTPS (e.g. behind a
     reverse proxy that terminates TLS)

   `.env` holds real secrets and is gitignored — never commit it.

2. Build and start:

   ```bash
   docker compose up -d --build
   ```

3. Check the container is healthy:

   ```bash
   docker compose ps
   ```

4. Open **http://localhost:3000** and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

The app only binds to `127.0.0.1:3000` on the host — it is not reachable from other machines
unless you put a reverse proxy in front of it. Lock down database access on the Atlas side via
its IP access list / network peering rather than relying on the app alone.

## Day-to-day operations

```bash
# View app logs
docker compose logs -f app

# Stop
docker compose down
```

There is no local database volume to worry about — all data lives in Atlas.

## Backups

Use `mongodump`/`mongorestore` directly against the Atlas connection string (run from any
machine with network access to the cluster, not necessarily inside the app container):

```bash
source .env
mongodump --uri "$MONGODB_URI" --db "$MONGODB_DB" --archive=backup-$(date +%F).archive
```

Store the resulting `.archive` file on separate storage. Atlas also offers built-in continuous
backups/snapshots on paid tiers — check your cluster's Backup tab.

## Restore

```bash
source .env
mongorestore --uri "$MONGODB_URI" --db "$MONGODB_DB" --drop --archive=./backup-YYYY-MM-DD.archive
```

## Upgrading

```bash
git pull
docker compose up -d --build
```

Take a backup before any upgrade that changes the transaction schema.

## Local development (without Docker)

```bash
cd app
npm install
cp ../.env.example .env.local   # Next.js reads .env.local automatically; fill in real values,
                                 # pointing MONGODB_URI at your Atlas cluster
npm run dev
```

Run the test suite and linter:

```bash
npm test
npm run lint
```

## Design notes

- Money is stored as integer paise everywhere (`amountPaise`), never floats.
- `transactionDate` is local (Asia/Kolkata) calendar date as `YYYY-MM-DD`, independent of the
  server's own timezone.
- Every transaction has a `module` (`shop` or `personal`) so the two ledgers never mix, and a
  `source` field (currently always `"manual"`) so future automated imports don't need a
  migration.
- Shop turnover is never counted as personal income directly — only money explicitly recorded
  as a `shop_draw` personal-income transaction (i.e. money you actually moved out of the shop)
  counts toward personal income and net worth.
- Net worth is computed from manually-maintained account balances (`accounts` collection), not
  derived from the transaction ledger — you update a balance when it changes (bank statement,
  investment valuation, etc.).
- Dashboard summaries report **cash flow**, not formal accounting profit.
