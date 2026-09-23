# Aviraj Personal Admin — Design & Phase History

## Context
This supersedes the shop-only scope in `2026-09-23-shop-hisab-kitab-design.md`. The project is
a private consolidated financial command center covering salary, shop, personal finances,
freelancing, loans, and investments, built in phases and merged incrementally.

## Phase 1 (foundation)
- Renamed app: "Aviraj Personal Admin"
- Unified `transactions` collection tagged with `module: "shop" | "personal"` so shop and
  personal cash flow never mix, and a manual `shop_draw` income category is the *only* way
  shop money counts as personal income (shop turnover is never double-counted)
- `accounts` collection: manually-maintained balances for bank, cash, other assets, and loans
  (a coarse `investment`/`pf` type also existed here before Phase 3 added dedicated modules)
- `salary_records` collection: monthly gross/deductions/status, manually entered
- Consolidated admin overview (`/`) with a period filter
- Nav-based module pages: Overview (`/`), Salary (`/salary`), Shop (`/shop`), Personal (`/personal`)

## Phase 2 + 3 (built in parallel, then merged)
Three independent modules were built concurrently in isolated git worktrees and merged:

**Freelancing** (`/freelance`) — `clients`, `work_logs`, `invoices`, `lead_expenses` collections.
Unbilled work (`work_logs` with `invoiced: false`) and receivables (`invoices` with
`status: "issued"`) are strictly separate — issuing an invoice atomically flips the referenced
work logs to `invoiced: true`. USD clients store amounts in cents plus an `exchangeRateToInr`
and `feesMinor`, with `netInrPaise` as the actual INR settled amount (recorded for real at
payment time). See `app/src/lib/freelance.ts` for the gross/net calculation helpers.

**Loans** (`/loans`) — `loans` + `loan_payments` collections track a full repayment schedule per
lender (paid/pending installment counts, total paid, projected remaining scheduled payments).
Outstanding principal is a separate, manually-updated field — never derived from the payment
schedule, since the interest/principal split isn't always known. This is independent of the
older generic `accounts` `type: "loan"` balances.

**Investments** (`/investments`) — `investments` + `investment_valuations` collections track
holdings (equity, mutual funds, fixed deposits, savings) with a valuation history trail, gain/loss
vs. invested amount where known. Supersedes the coarse `accounts` `type: "investment"` balance.

## Phase 4 (consolidation, this pass)
The admin overview (`/api/admin/overview`) now pulls from all modules:
- `investmentsTotal` = sum of `investments.currentValuePaise` (the `accounts` `type: "investment"`
  balance is now ignored here to avoid double-counting once holdings live in the investments module)
- `liabilitiesTotal` = sum of `accounts` `type: "loan"` balances + sum of `loans.outstandingPrincipalPaise`
  for `status: "active"` loans
- `incomeSources.freelance` / `monthlyIncome` include `invoices.netInrPaise` for invoices paid
  within the selected period
- `receivables` = sum of `netInrPaise` across all currently-`issued` invoices (a snapshot, not
  period-filtered — it's "what's owed right now")

## Still deferred
- Recurring-entry automation (auto-generating expected monthly salary/PF/EMI entries) and a
  worker process to run it
- Scheduled/automated backups (manual `mongodump` documented in the README)
- An audit log of financial record edits
- A per-client freelance detail page (the current `/freelance` page is a single page with all
  clients/work/invoices inline, by design, to keep Phase 2 scoped)

These need their own design pass — each is a real feature, not a quick add-on.
