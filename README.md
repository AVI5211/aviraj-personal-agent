# Shop Hisab Kitab

A private, self-hosted cash-flow dashboard for a single retail shop: track daily BharatPe QR
collections, cash income, and expenses, with opening/closing balance and monthly trends.

Not an ERP, inventory system, or CRM — see `docs/superpowers/specs/2026-09-23-shop-hisab-kitab-design.md`
for the full v1 design and scope decisions.

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
   - `OPENING_BALANCE_PAISE` — starting cash balance in paise (e.g. `1000000` = ₹10,000.00)
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
- `transactionDate` is the shop's local (Asia/Kolkata) calendar date as `YYYY-MM-DD`, independent
  of the server's own timezone.
- Every transaction carries a `source` field (currently always `"manual"`) so a future automated
  BharatPe import can be added without a schema migration.
- BharatPe bank settlements are never recorded separately as income — only the daily BharatPe
  collection total — to avoid double-counting.
- Dashboard summaries report **cash flow** (opening balance + income − expenses), not formal
  accounting profit.
