# Aviraj Personal Admin — Phase 1 Design

## Context
This supersedes the shop-only scope in `2026-09-23-shop-hisab-kitab-design.md`. The project is
now a private consolidated financial command center covering salary, shop, personal finances,
and (later) freelancing/loans/investments detail modules, per the owner's 4-phase blueprint.

## Phase 1 scope (implemented)
- Renamed app: "Aviraj Personal Admin"
- Unified `transactions` collection tagged with `module: "shop" | "personal"` so shop and
  personal cash flow never mix, and a manual `shop_draw` income category is the *only* way
  shop money counts as personal income (shop turnover is never double-counted)
- `accounts` collection: manually-maintained balances for bank, cash, investment, PF, other
  assets, and loans (liabilities) — net worth = assets − liabilities, using latest balances
- `salary_records` collection: monthly gross/deductions/status, manually entered
- Consolidated admin overview (`/`) with a period filter: net worth, monthly income/expense,
  income-by-source (salary, shop draw, freelance placeholder), financial position breakdown
- Nav-based module pages: Overview (`/`), Salary (`/salary`), Shop (`/shop`), Personal (`/personal`)
- Shop module is functionally unchanged from the original app, just scoped by `module: "shop"`

## Deferred (owner's own phases 2–4)
- Freelancing: clients, timesheets, invoices, receivables, USD contracts
- Loans: per-lender repayment schedules, EMI automation
- Investments: holdings/valuations detail beyond a single manual balance per account
- Recurring rules (salary/PF/EMI automation), a worker process, scheduled backups
- Audit log of financial record changes

These are large enough that each warrants its own design pass before building — see the
phase breakdown in the original request for suggested order.

## Data model additions
```
accounts: { _id, name, type: bank|cash|investment|pf|other_asset|loan, balancePaise, createdAt, updatedAt }
salary_records: { _id, month: "YYYY-MM" (unique), grossPaise, deductionsPaise, status: expected|received, receivedDate, note, createdAt, updatedAt }
transactions: (existing shape) + module: "shop" | "personal"
```

## Admin overview calculation
- `netWorth` = sum(bank+cash+investment+pf+other_asset balances) − sum(loan balances)
- `monthlyIncome` (period-scoped) = salary net (gross − deductions, records in range) +
  personal-module income where `category = "shop_draw"` + other personal income
- `monthlyExpense` = personal-module expenses only (shop expenses are business cost, not
  personal spend, and are shown separately as `shopNetCashFlow`)
- `receivables` and `incomeSources.freelance` are hardcoded to 0 pending the freelance module
