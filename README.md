# Aviraj Personal Admin

A private, self-hosted financial command center: consolidated net worth and cash flow across
salary, shop, and personal finances, in one Docker Compose app backed by MongoDB.

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
- MongoDB 7 via the official Node driver — internal Docker network only, no public port
- Two Docker Compose services: `app` and `mongodb`. No Redis, no separate backend.

## First-time setup

1. Copy the environment template and fill in real values:

   ```bash
   cp .env.example .env
   ```

   - `MONGO_USER` / `MONGO_PASSWORD` — MongoDB root credentials (internal network only)
   - `SESSION_SECRET` — 32+ random characters, e.g. `openssl rand -base64 32`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — the one login for the dashboard
   - `OPENING_BALANCE_PAISE` — shop's starting cash balance in paise (e.g. `1000000` = ₹10,000.00)
   - `COOKIE_SECURE` — leave `false` unless the app is reachable over HTTPS (e.g. behind a
     reverse proxy that terminates TLS)

2. Build and start:

   ```bash
   docker compose up -d --build
   ```

3. Check both containers are healthy:

   ```bash
   docker compose ps
   ```

4. Open **http://localhost:3000** and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

The app only binds to `127.0.0.1:3000` on the host — it is not reachable from other machines
unless you put a reverse proxy in front of it. MongoDB's port is never published to the host.

## Day-to-day operations

```bash
# View app logs
docker compose logs -f app

# View MongoDB logs
docker compose logs -f mongodb

# Stop (keeps data)
docker compose down

# Stop and remove all data (irreversible)
docker compose down -v
```

## Backups

The `mongo_data` Docker volume gives you persistence across restarts, but it is **not** a
backup — take one regularly with `mongodump`:

```bash
source .env
docker compose exec mongodb mongodump \
  -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
  --db shop_hisab --archive=/tmp/backup.archive
docker compose cp mongodb:/tmp/backup.archive ./backup-$(date +%F).archive
```

Store the resulting `.archive` file on separate storage (not on the same disk as the volume).

## Restore

```bash
source .env
docker compose cp ./backup-YYYY-MM-DD.archive mongodb:/tmp/restore.archive
docker compose exec mongodb mongorestore \
  -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin \
  --drop --archive=/tmp/restore.archive
```

## Upgrading

```bash
git pull
docker compose up -d --build
```

MongoDB's data volume is untouched by rebuilding the `app` image. Take a backup before any
upgrade that changes the transaction schema.

## Local development (without Docker)

```bash
cd app
npm install
cp ../.env.example .env.local   # Next.js reads .env.local automatically; fill in real values,
                                 # and point MONGODB_URI at a local MongoDB instance
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
