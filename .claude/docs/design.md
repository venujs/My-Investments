# My Investments — Design & Technical Reference

> Personal investment portfolio tracker covering FDs, RDs, Mutual Funds, Shares, Gold, Loans, Fixed Assets, Pension, and Savings Accounts with valuation, goals, tax computation, and snapshot-based analytics.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Source File Reference](#4-source-file-reference)
5. [Database Design](#5-database-design)
6. [Entity Relationship Diagram](#6-entity-relationship-diagram)
7. [API Reference](#7-api-reference)
8. [Architectural Patterns](#8-architectural-patterns)
9. [Design Decisions](#9-design-decisions)
10. [Conventions](#10-conventions)
11. [Constraints & Limitations](#11-constraints--limitations)

---

## 1. Application Overview

My Investments is a self-hosted personal finance tracker designed for Indian investors. It handles the full lifecycle of a multi-asset portfolio:

- **Record keeping**: All investment types (FD, RD, MF equity/hybrid/debt, shares, gold, loans, fixed assets, pension, savings accounts) in a unified data model
- **Valuation**: Live and historical valuation using compound interest formulas, market prices, and FIFO lot tracking
- **Goals**: Link investments to financial goals, track progress, and simulate future outcomes
- **Tax**: Capital gains computation (LTCG/STCG) aligned with Indian FY (April–March)
- **Analytics**: Net worth history, type breakdown, XIRR per investment type
- **Automation**: Recurring transaction rules, CSV import/export, historical snapshot generation

The application is designed for personal or family use with PIN-based multi-user support (no passwords, no OAuth).

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Server runtime** | Node.js | ≥20.0.0 | ESM modules (`"type": "module"`) |
| **Server framework** | Express | 5.1 | Async route handlers, no callback-style |
| **Database** | sql.js (SQLite via WASM) | 1.11 | In-memory + disk persistence |
| **Server language** | TypeScript | 5.x | Strict mode, `tsc` for build |
| **Client framework** | React | 19 | Vite bundler |
| **Client language** | TypeScript | 5.x | `noEmit: true` (Vite uses esbuild) |
| **State management** | TanStack React Query | 5.x | Server state, query/mutation |
| **UI components** | shadcn/ui | latest | Radix primitives + Tailwind |
| **Styling** | Tailwind CSS | 4.x | Utility-first |
| **Charts** | Recharts | 2.x | Area, pie, bar charts |
| **HTTP client** | Axios | 1.x | API calls from client |
| **Validation** | Zod | 3.x | Shared schemas, server + client |
| **CSV parsing** | PapaParse | 5.x | Server-side import processing |
| **Auth hashing** | bcryptjs | 2.x | PIN hashing (10 rounds) |
| **Session store** | express-session | 1.x | Custom SQLite store |
| **Dev server** | concurrently | - | Runs server (3002) + client (5173) |

---

## 3. Monorepo Structure

```
my-investments/
├── package.json              ← npm workspaces root
├── shared/                   ← Shared TypeScript types + Zod validators
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts          ← All TypeScript interfaces
│       ├── enums.ts          ← Enums + label maps
│       ├── validators.ts     ← Zod schemas
│       └── index.ts          ← Re-exports
├── server/                   ← Express API server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          ← Bootstrap (DB init, startup jobs, listen)
│       ├── app.ts            ← Express setup, session, route mounting
│       ├── db/
│       │   ├── connection.ts ← sql.js wrapper + disk save
│       │   └── schema.sql    ← Full SQLite schema
│       ├── middleware/
│       │   ├── auth.ts       ← requireAuth, requireAdmin
│       │   ├── validate.ts   ← Zod middleware
│       │   └── errorHandler.ts
│       ├── routes/           ← Thin route handlers (validate → service → respond)
│       │   ├── auth.ts
│       │   ├── users.ts
│       │   ├── investments.ts
│       │   ├── transactions.ts
│       │   ├── goals.ts
│       │   ├── snapshots.ts
│       │   ├── analytics.ts
│       │   ├── tax.ts
│       │   ├── market.ts
│       │   ├── recurring.ts
│       │   ├── settings.ts
│       │   └── importExport.ts
│       ├── services/         ← All business logic
│       │   ├── investmentService.ts
│       │   ├── valuationService.ts
│       │   ├── transactionService.ts
│       │   ├── calculationService.ts
│       │   ├── snapshotService.ts
│       │   ├── goalService.ts
│       │   ├── taxService.ts
│       │   ├── userService.ts
│       │   ├── importService.ts
│       │   ├── exportService.ts
│       │   ├── marketDataService.ts
│       │   └── recurringService.ts
│       └── utils/
│           ├── date.ts       ← Date arithmetic helpers
│           └── inr.ts        ← Paise ↔ rupee conversion
├── client/                   ← React SPA
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/              ← Axios API functions (one file per domain)
│       ├── hooks/            ← React Query hooks wrapping API calls
│       ├── pages/            ← One page component per route
│       ├── components/
│       │   ├── layout/       ← AppShell, Sidebar, Header, MobileNav
│       │   ├── auth/         ← PinInput, UserSelector
│       │   ├── shared/       ← Reusable components (InrAmount, ConfirmDialog, etc.)
│       │   └── ui/           ← shadcn/ui primitives
│       ├── contexts/
│       │   └── AuthContext.tsx
│       └── lib/
│           ├── inr.ts        ← Paise format helpers
│           ├── constants.ts  ← Investment type labels, chart colors
│           └── utils.ts      ← cn() Tailwind merge helper
└── data/
    └── my-investments.db     ← SQLite database (auto-created)
```

**Build order matters**: `shared` must build first (server and client depend on it):
```bash
npm run build   # → shared → client → server
```

**Development proxy**: Vite dev server proxies `/api/*` to `http://localhost:3002` so client and server can run independently.

---

## 4. Source File Reference

### 4.1 Shared Package

| File | Purpose |
|------|---------|
| `shared/src/types.ts` | All TypeScript interfaces: `User`, `Investment`, all detail types (`FDDetail`, `MFDetail`, etc.), `InvestmentTransaction`, `InvestmentLot`, `Goal`, `NetWorthSnapshot`, `DashboardStats`, `TaxSummary`, etc. |
| `shared/src/enums.ts` | Enums and label maps: `InvestmentType`, `InvestmentTxnType`, `CompoundingFrequency`, `GoldForm`, `GoldPurity`, `Exchange`, `PensionType`, `LoanType`, `FixedAssetCategory`, `RecurrenceFrequency`, `InvestmentTypeLabels` |
| `shared/src/validators.ts` | Zod schemas for every API request body: auth, investment CRUD with detail schemas per type, transactions, sell, overrides, goals, recurring rules, tax, import |
| `shared/src/index.ts` | Re-exports everything from types, enums, validators |

### 4.2 Server — Core

| File | Purpose |
|------|---------|
| `server/src/index.ts` | Entry point: calls `initializeDbAsync()`, generates pending recurring transactions, fires `fetchAllMarketData()` non-blocking, schedules recurring (6h) + market (24h) intervals, calls `app.listen()` on PORT (default 3002) |
| `server/src/app.ts` | Creates Express app: trust-proxy for production, CORS (`origin: true, credentials: true`), JSON body parser, session middleware with custom `SqliteSessionStore`, all route mounts at `/api/*`, static file serving of `client/dist` in production, catch-all for React SPA routing |

### 4.3 Server — Database

| File | Purpose |
|------|---------|
| `server/src/db/connection.ts` | `DatabaseWrapper` class wraps sql.js `Database` to provide better-sqlite3-style API. `PreparedStatement` provides `.get()`, `.all()`, `.run()`. `transaction(fn)` wraps in `BEGIN/COMMIT/ROLLBACK`. Debounce-saves to disk every 1 second via `scheduleSave()`. `initializeDbAsync()` loads or creates the DB file, runs schema.sql, applies migrations. |
| `server/src/db/schema.sql` | Complete SQLite DDL: 20+ tables with FK constraints, CHECK constraints, and indexes. See [Section 5](#5-database-design) for full schema details. |

### 4.4 Server — Middleware

| File | Purpose |
|------|---------|
| `server/src/middleware/auth.ts` | `requireAuth`: checks `req.session.userId`, returns 401 if absent. `requireAdmin`: checks `user.is_admin`, returns 403. Both attach `userId` to session. |
| `server/src/middleware/validate.ts` | `validate(schema)`: calls `schema.parse(req.body)`, assigns cleaned body back to `req.body`, returns 400 with `{error, details}` on failure. Unknown fields are silently stripped by Zod. |
| `server/src/middleware/errorHandler.ts` | Global error handler: catches unhandled errors from route handlers, returns `{error: message}` with 500 status. |

### 4.5 Server — Routes

All route files follow the same pattern: `requireAuth` → `validate(schema)` → call service → `res.json()`.

| File | Prefix | Key Endpoints |
|------|--------|---------------|
| `auth.ts` | `/api/auth` | GET /users (no auth), POST /login (no auth), POST /logout, GET /me, POST /setup (no auth, only if no users exist) |
| `users.ts` | `/api/users` | CRUD users, POST /:id/change-pin |
| `investments.ts` | `/api/investments` | CRUD investments + detail, POST /clear-all, POST /clear-by-type/:type, POST /:id/override, GET /:id/overrides. Auto-creates gold buy txn and RD recurring rule on investment creation. |
| `transactions.ts` | `/api` | GET/POST /:id/transactions, POST /:id/sell (FIFO), GET /:id/lots, PUT/DELETE /transactions/:id, POST /transactions/clear-all |
| `goals.ts` | `/api/goals` | CRUD goals, POST /:id/investments (assign), DELETE /:id/investments/:inv, GET /:id/history, POST /:id/simulate |
| `snapshots.ts` | `/api/snapshots` | POST /calculate, GET /net-worth, POST /clear, POST /generate-historical (responds immediately, runs async), GET /job-status, GET /list, GET /detail/:yearMonth |
| `analytics.ts` | `/api/analytics` | GET /dashboard, GET /net-worth-chart, GET /breakdown, GET /type-xirr/:type, GET /type-history/:type |
| `tax.ts` | `/api/tax` | POST /calculate (with FY range), GET /gains (current FY) |
| `market.ts` | `/api/market` | POST /fetch (all), GET /price/:symbol, GET /gold, GET /history/:symbol, POST /price (manual), POST /fetch-mf/:isin, GET /mf/scheme/:code, GET /mf/search |
| `recurring.ts` | `/api/recurring` | CRUD rules, POST /generate |
| `settings.ts` | `/api/settings` | GET/PUT /type-rates, POST /purge-all-data |
| `importExport.ts` | `/api` | POST /import/upload (multipart), GET /export/template/:type, GET /export/investments, GET /export/transactions |

### 4.6 Server — Services

| File | Responsibility |
|------|---------------|
| `investmentService.ts` | Polymorphic CRUD: reads/writes `investments` + type-specific detail table in a transaction. `DETAIL_TABLES` maps type → table name. `getAllInvestments()` joins base + detail. `enrichInvestment()` delegates to valuationService for computed fields. |
| `valuationService.ts` | `getCurrentValue(inv)` dispatches to type-specific logic (formulas / market prices / manual override). `enrichInvestment(inv)` adds `current_value_paise`, `invested_amount_paise`, `gain_paise`, `gain_percent`, `xirr`. `calculateTypeXIRR()` aggregates across all investments of a type. |
| `transactionService.ts` | CRUD for `investment_transactions`. `createTransaction()` auto-creates a lot in `investment_lots` for buy/sip. `executeSell()` does FIFO allocation against `investment_lots`, writes `lot_sell_allocations`. `getTotalUnitsAsOf()`, `getTotalInvestedAsOf()` for historical queries. |
| `calculationService.ts` | Pure financial math functions. No DB access. All inputs/outputs in paise. |
| `snapshotService.ts` | `calculateMonthlySnapshots()` writes per-investment rows. `calculateNetWorthSnapshot()` writes aggregate row with `breakdown_json`. `generateHistoricalSnapshots()` (async): loops 46 months (36 monthly + 10 yearly), fetches historical prices, yields event loop after each investment and after each XIRR computation. |
| `goalService.ts` | Goal CRUD + investment linkage. `getGoalHistory()` joins monthly_snapshots with goal_investments to produce actual/projected/ideal series. `simulate()` projects future value with compound growth. |
| `taxService.ts` | `calculateCapitalGains()`: fetches sell transactions in FY window, for each sell looks up lot allocations (FIFO cost basis), computes holding period, classifies LTCG/STCG, applies Indian tax rates. |
| `userService.ts` | User CRUD with bcrypt PIN hashing. `verifyPin()` uses `bcrypt.compare()`. `getUserCount()` drives the setup gate. |
| `importService.ts` | `getTemplate()` generates CSV templates with hint/example rows. `processImport()` parses CSV via PapaParse, filters `#` comment rows, creates investments + transactions with error tracking per row. Handles all investment types including MF sell (FIFO), RD recurring rule creation, and share sell (FIFO). |
| `exportService.ts` | `exportInvestments()` and `exportTransactions()` query DB, enrich values, and return CSV strings with headers. |
| `marketDataService.ts` | Fetches from mfapi.in (MF NAV) and Yahoo Finance (stocks, gold). `fetchMFNavForDate()` checks cache first, then bulk-fetches history via `fetchMFNavHistory()` and batch-inserts in a single transaction. `fetchStockPriceForDate()` similarly. `resolveSchemeCode()` handles ISIN → numeric AMFI code translation. |
| `recurringService.ts` | Rule CRUD. `generateRecurringTransactions()`: for each active rule, loops from `last_generated` (or `start_date`) to today, creates transactions (with price fetching for MF/shares), updates `last_generated`. |

### 4.7 Server — Utilities

| File | Purpose |
|------|---------|
| `utils/date.ts` | `today()`, `yearsBetween()`, `daysBetween()`, `addDays()`, `addMonths()`, `addYears()`, `currentYearMonth()`. All work with `YYYY-MM-DD` strings to avoid timezone issues. |
| `utils/inr.ts` | `toPaise(rupees)` → `Math.round(rupees * 100)`. `toRupees(paise)` → `paise / 100`. |

### 4.8 Client — API Layer

Each file in `client/src/api/` exports a typed object of async functions using a shared Axios instance (`api/client.ts`). The Axios instance points to `/api` (proxied to port 3002 in dev).

| File | Functions |
|------|-----------|
| `auth.ts` | `getUsers`, `login`, `logout`, `me`, `setup` |
| `investments.ts` | `getAll`, `getByType`, `getById`, `create`, `update`, `delete`, `clearAll`, `clearByType`, `addOverride`, `getOverrides` |
| `transactions.ts` | `getByInvestment`, `getAll`, `create`, `sell`, `getLots`, `update`, `delete`, `clearAll` |
| `goals.ts` | `getAll`, `getById`, `create`, `update`, `delete`, `assignInvestment`, `removeInvestment`, `getHistory`, `simulate` |
| `snapshots.ts` | `calculate`, `getNetWorth`, `clear`, `generateHistorical`, `getJobStatus`, `getList`, `getDetail` |
| `analytics.ts` | `getDashboard`, `getNetWorthChart`, `getBreakdown`, `getTypeXIRR`, `getTypeHistory` |
| `market.ts` | `fetch`, `getPrice`, `getGoldPrice`, `getHistory`, `setManualPrice`, `fetchMFNav`, `getSchemeDetails`, `searchMF` |
| `tax.ts` | `calculate`, `getGains` |
| `recurring.ts` | `getAll`, `getById`, `create`, `update`, `delete`, `generate` |
| `settings.ts` | `getTypeRates`, `updateTypeRates`, `purgeAllData` |

### 4.9 Client — Hooks Layer

Each `hooks/useXxx.ts` file exports React Query `useQuery`/`useMutation` hooks. Mutations call `queryClient.invalidateQueries()` on success to keep the cache fresh.

| File | Key Hooks |
|------|-----------|
| `useInvestments.ts` | `useInvestments()`, `useInvestmentsByType(type)`, `useCreateInvestment()`, `useUpdateInvestment()`, `useDeleteInvestment()`, `useClearAllInvestments()`, `useClearInvestmentsByType()` |
| `useTransactions.ts` | `useTransactions(investmentId)`, `useCreateTransaction()`, `useSell()`, `useLots()`, `useClearAllTransactions()` |
| `useGoals.ts` | `useGoals()`, `useGoal(id)`, `useCreateGoal()`, `useGoalHistory(id)`, `useSimulateGoal()`, `useAssignInvestment()` |
| `useSnapshots.ts` | `useNetWorthHistory()`, `useCalculateSnapshots()`, `useGenerateHistoricalSnapshots()`, `useSnapshotJobStatus()` (polls every 2s while running), `useSnapshotList()`, `useSnapshotDetail(yearMonth)` |
| `useAnalytics.ts` | `useDashboardStats()`, `useNetWorthChart()`, `useInvestmentBreakdown()`, `useTypeXIRR(type)`, `useTypeHistory(type)` |
| `useMarket.ts` | `useFetchMarketData()`, `usePriceHistory(symbol)`, `useManualPrice()` |
| `useSettings.ts` | `useTypeRates()`, `useUpdateTypeRates()`, `usePurgeAllData()` |
| `useRecurring.ts` | `useRecurringRules()`, `useCreateRule()`, `useGenerateRecurring()` |
| `useTax.ts` | `useTaxGains()`, `useCalculateTax()` |

### 4.10 Client — Pages

| Page File | Route | Description |
|-----------|-------|-------------|
| `LoginPage.tsx` | `/login` | User list + PIN input. On success, stores user in AuthContext. |
| `SetupPage.tsx` | `/setup` | Admin user creation wizard. Only accessible if `getUserCount() === 0`. |
| `DashboardPage.tsx` | `/` | Total invested/value/gain/net worth cards, net worth area chart, allocation pie chart, type history chart, job status banner for historical snapshot generation. |
| `FDPage.tsx` | `/fd` | Fixed deposit CRUD: create/edit inline forms, per-FD transaction list. |
| `RDPage.tsx` | `/rd` | Recurring deposit CRUD with auto-created recurring rule. |
| `MutualFundsPage.tsx` | `/mutual-funds` | MF CRUD (equity/hybrid/debt tabs), NAV auto-fetch, AMFI scheme search dialog, ISIN display. |
| `SharesPage.tsx` | `/shares` | Share CRUD, FIFO lot display, sell dialog with lot preview. |
| `GoldPage.tsx` | `/gold` | Gold CRUD with weight + purity tracking. |
| `LoansPage.tsx` | `/loans` | Loan CRUD with outstanding balance display. |
| `FixedAssetsPage.tsx` | `/fixed-assets` | Fixed asset CRUD with appreciation rate. |
| `PensionPage.tsx` | `/pension` | Pension (NPS/EPF/PPF/gratuity) CRUD with deposit tracking. |
| `SavingsAccountsPage.tsx` | `/savings` | Savings account CRUD with balance from transactions. |
| `GoalsPage.tsx` | `/goals` | Goal CRUD, investment assignment with allocation %, actual/projected/ideal chart, simulation inputs. |
| `TaxPage.tsx` | `/tax` | LTCG/STCG breakdown by holding period, FY selector, per-transaction detail. |
| `ImportPage.tsx` | `/import` | CSV upload wizard: select type → download template → upload file → view results/errors. |
| `ExportPage.tsx` | `/export` | One-click CSV download for investments and transactions, with optional type filter. |
| `SnapshotsPage.tsx` | `/snapshots` | Snapshot browser: list of months, expand month to see per-investment values, XIRR + gain% per investment type from breakdown JSON. |
| `RecurringPage.tsx` | `/recurring` | Recurring rule CRUD: frequency, amount, date range. Generate Transactions button. |
| `SettingsPage.tsx` | `/settings` | User info, default appreciation rates per investment type, danger zone (clear transactions, delete investments, Purge All Data nuclear button). |

### 4.11 Client — Components

| Component | Purpose |
|-----------|---------|
| `layout/AppShell.tsx` | Top-level layout wrapper: Sidebar (desktop), MobileNav (mobile), main content area. |
| `layout/Sidebar.tsx` | Navigation links to all pages, grouped by category. |
| `auth/PinInput.tsx` | 4–8 character PIN input with masked display. |
| `auth/UserSelector.tsx` | Avatar + name buttons for all registered users. |
| `shared/InrAmount.tsx` | Displays a paise integer as formatted INR (e.g., `₹1,00,000.00`). |
| `shared/AmountInput.tsx` | Number input that takes paise internally, displays as rupees with ₹ prefix. |
| `shared/ConfirmDialog.tsx` | Reusable destructive action confirmation dialog with `destructive` variant styling. |
| `shared/EditTransactionDialog.tsx` | Generic transaction edit form for date, amount, units, price, notes. |
| `shared/InvestmentSummaryCard.tsx` | Summary row showing invested/value/gain for a single investment. |
| `shared/EmptyState.tsx` | "No data" placeholder with optional CTA button. |
| `ui/*` | shadcn/ui primitives: Button, Card, Input, Label, Dialog, Select, Badge, Progress, Tabs, Textarea, ScrollArea, Separator. |

---

## 5. Database Design

### 5.1 Table Reference

#### `users`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL | Display name |
| pin_hash | TEXT | NOT NULL | bcrypt hash of 4–8 char PIN |
| avatar | TEXT | nullable | Emoji or URL |
| is_admin | INTEGER | NOT NULL DEFAULT 0 | Boolean (0/1) |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | ISO timestamp |

#### `settings`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| key | TEXT | PRIMARY KEY | e.g., `rate_fd`, `rate_mf_equity` |
| value | TEXT | NOT NULL | Stored as string |

Default keys: `rate_fd`, `rate_rd`, `rate_mf_equity`, `rate_mf_hybrid`, `rate_mf_debt`, `rate_shares`, `rate_gold`, `rate_loan`, `rate_fixed_asset`, `rate_pension`, `rate_savings_account`.

#### `investments` (polymorphic base)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK AUTOINCREMENT | |
| user_id | INTEGER | NOT NULL FK→users(id) | |
| investment_type | TEXT | NOT NULL CHECK(enum) | fd, rd, mf_equity, mf_hybrid, mf_debt, shares, gold, loan, fixed_asset, pension, savings_account |
| name | TEXT | NOT NULL | User-defined name |
| institution | TEXT | nullable | Bank/broker name |
| notes | TEXT | nullable | Free text |
| is_active | INTEGER | NOT NULL DEFAULT 1 | Boolean |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') | |
| updated_at | TEXT | NOT NULL DEFAULT datetime('now') | |

*Indexes: investments(user_id), investments(investment_type)*

#### `investment_fd`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| principal_paise | INTEGER NOT NULL | |
| interest_rate | REAL NOT NULL | 0–100 |
| compounding | TEXT NOT NULL | monthly/quarterly/half_yearly/yearly |
| start_date | TEXT NOT NULL | YYYY-MM-DD |
| maturity_date | TEXT NOT NULL | YYYY-MM-DD |
| bank_name | TEXT | nullable |
| branch | TEXT | nullable |
| fd_number | TEXT | nullable |

#### `investment_rd`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| monthly_installment_paise | INTEGER NOT NULL | |
| interest_rate | REAL NOT NULL | |
| compounding | TEXT NOT NULL | monthly/quarterly/half_yearly/yearly |
| start_date | TEXT NOT NULL | First EMI date |
| maturity_date | TEXT NOT NULL | One month after last EMI |
| bank_name | TEXT | nullable |
| branch | TEXT | nullable |

#### `investment_mf`
Shared by `mf_equity`, `mf_hybrid`, `mf_debt`.

| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| isin_code | TEXT NOT NULL | ISIN (INF...) or legacy numeric AMFI code |
| scheme_code | TEXT | Numeric AMFI code for mfapi.in API calls |
| scheme_name | TEXT | nullable |
| folio_number | TEXT | nullable |
| amc | TEXT | nullable — Fund house name |

#### `investment_shares`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| ticker_symbol | TEXT NOT NULL | e.g., RELIANCE |
| exchange | TEXT NOT NULL DEFAULT 'NSE' | NSE or BSE |
| company_name | TEXT | nullable |
| demat_account | TEXT | nullable |

#### `investment_gold`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| form | TEXT NOT NULL | physical/digital/sovereign_bond |
| weight_grams | REAL NOT NULL | |
| purity | TEXT NOT NULL DEFAULT '24K' | 24K/22K/18K |
| purchase_price_per_gram_paise | INTEGER NOT NULL | |
| purchase_date | TEXT | nullable (migration-added column) |

#### `investment_loan`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| principal_paise | INTEGER NOT NULL | Original loan amount |
| interest_rate | REAL NOT NULL | Annual rate |
| emi_paise | INTEGER NOT NULL | Monthly EMI |
| start_date | TEXT NOT NULL | First EMI date |
| end_date | TEXT | nullable |
| loan_type | TEXT NOT NULL DEFAULT 'other' | home/car/personal/education/gold/other |
| lender | TEXT | nullable |

#### `investment_fixed_asset`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| category | TEXT NOT NULL DEFAULT 'other' | property/vehicle/jewelry/art/other |
| purchase_date | TEXT NOT NULL | |
| purchase_price_paise | INTEGER NOT NULL | |
| inflation_rate | REAL NOT NULL DEFAULT 6.0 | Annual appreciation rate |
| description | TEXT | nullable |

#### `investment_pension`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| pension_type | TEXT NOT NULL DEFAULT 'other' | nps/epf/ppf/gratuity/other |
| interest_rate | REAL NOT NULL DEFAULT 0 | |
| account_number | TEXT | nullable |

#### `investment_savings_account`
| Column | Type | Notes |
|--------|------|-------|
| investment_id | INTEGER PK FK→investments | |
| bank_name | TEXT | nullable |
| account_number | TEXT | nullable |
| interest_rate | REAL NOT NULL DEFAULT 0 | |
| ifsc | TEXT | nullable |

#### `investment_transactions`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| investment_id | INTEGER NOT NULL FK→investments | CASCADE DELETE |
| user_id | INTEGER NOT NULL FK→users | |
| txn_type | TEXT NOT NULL CHECK(enum) | buy/sell/deposit/withdrawal/dividend/interest/sip/emi/premium/bonus/split/maturity |
| date | TEXT NOT NULL | YYYY-MM-DD |
| amount_paise | INTEGER NOT NULL | |
| units | REAL | nullable — for MF/shares |
| price_per_unit_paise | INTEGER | nullable |
| fees_paise | INTEGER NOT NULL DEFAULT 0 | |
| notes | TEXT | nullable |
| recurring_rule_id | INTEGER FK→recurring_rules | nullable |
| import_batch_id | INTEGER FK→import_batches | nullable |
| created_at | TEXT NOT NULL | |

*Indexes: transactions(investment_id), transactions(date), transactions(user_id)*

#### `investment_lots`
FIFO lot tracking for MF and shares.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| investment_id | INTEGER NOT NULL FK→investments | CASCADE DELETE |
| buy_txn_id | INTEGER NOT NULL FK→investment_transactions | CASCADE DELETE |
| buy_date | TEXT NOT NULL | YYYY-MM-DD |
| units_bought | REAL NOT NULL | |
| units_remaining | REAL NOT NULL | Decremented on each sell |
| cost_per_unit_paise | INTEGER NOT NULL | |

*Index: lots(investment_id)*

#### `lot_sell_allocations`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| sell_txn_id | INTEGER NOT NULL FK→investment_transactions | CASCADE DELETE |
| lot_id | INTEGER NOT NULL FK→investment_lots | CASCADE DELETE |
| units_sold | REAL NOT NULL | |
| cost_per_unit_paise | INTEGER NOT NULL | Cost basis from the lot |

#### `investment_overrides`
Manual value overrides that take precedence over computed valuations.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| investment_id | INTEGER NOT NULL FK→investments | CASCADE DELETE |
| override_date | TEXT NOT NULL | YYYY-MM-DD |
| value_paise | INTEGER NOT NULL | Value to use on/after this date |
| reason | TEXT | nullable |
| user_id | INTEGER NOT NULL FK→users | |

#### `monthly_snapshots`
Per-investment monthly valuation record.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| investment_id | INTEGER NOT NULL FK→investments | CASCADE DELETE |
| year_month | TEXT NOT NULL | YYYY-MM (e.g., 2025-03) |
| invested_paise | INTEGER NOT NULL DEFAULT 0 | |
| current_value_paise | INTEGER NOT NULL DEFAULT 0 | Value on the 1st of the month |
| gain_paise | INTEGER NOT NULL DEFAULT 0 | |

*UNIQUE(investment_id, year_month). Index: snapshots(year_month)*

#### `net_worth_snapshots`
Aggregate per-user monthly net worth record.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | INTEGER NOT NULL FK→users | |
| year_month | TEXT NOT NULL | YYYY-MM |
| total_invested_paise | INTEGER NOT NULL DEFAULT 0 | |
| total_value_paise | INTEGER NOT NULL DEFAULT 0 | |
| total_debt_paise | INTEGER NOT NULL DEFAULT 0 | Loan outstanding |
| net_worth_paise | INTEGER NOT NULL DEFAULT 0 | total_value − total_debt |
| breakdown_json | TEXT | JSON: `{type: {invested, value, count, gain, gain_percent, xirr}, _goals: {id: {name, value, target, progress}}}` |

*UNIQUE(user_id, year_month). Index: net_worth_snapshots(user_id)*

#### `market_prices`
Cached market prices for MF NAVs and stock prices.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| symbol | TEXT NOT NULL | ISIN/scheme code for MF; ticker for stocks |
| source | TEXT NOT NULL CHECK(enum) | mfapi/yahoo/manual |
| date | TEXT NOT NULL | YYYY-MM-DD |
| price_paise | INTEGER NOT NULL | |

*UNIQUE(symbol, source, date). Index: market_prices(symbol, date)*

#### `gold_prices`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| date | TEXT NOT NULL UNIQUE | YYYY-MM-DD |
| price_per_gram_paise | INTEGER NOT NULL | |

#### `goals`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | INTEGER NOT NULL FK→users | |
| name | TEXT NOT NULL | |
| target_amount_paise | INTEGER NOT NULL | |
| target_date | TEXT NOT NULL | YYYY-MM-DD |
| priority | INTEGER NOT NULL DEFAULT 5 | 1–10 |
| notes | TEXT | nullable |
| is_active | INTEGER NOT NULL DEFAULT 1 | |
| created_at | TEXT NOT NULL | |

*Index: goals(user_id)*

#### `goal_investments`
Many-to-many between goals and investments.

| Column | Type | Notes |
|--------|------|-------|
| goal_id | INTEGER NOT NULL FK→goals | CASCADE DELETE |
| investment_id | INTEGER NOT NULL FK→investments | CASCADE DELETE |
| allocation_percent | REAL NOT NULL DEFAULT 100 | What % of this investment counts toward this goal |

*PRIMARY KEY (goal_id, investment_id). Code enforces 1 goal per investment (see Design Decisions).*

#### `recurring_rules`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| investment_id | INTEGER NOT NULL FK→investments | CASCADE DELETE |
| user_id | INTEGER NOT NULL FK→users | |
| txn_type | TEXT NOT NULL CHECK(enum) | buy/sell/deposit/... |
| amount_paise | INTEGER NOT NULL | |
| frequency | TEXT NOT NULL CHECK(enum) | daily/weekly/monthly/yearly |
| day_of_month | INTEGER | nullable — for monthly frequency |
| start_date | TEXT NOT NULL | |
| end_date | TEXT | nullable |
| last_generated | TEXT | nullable — last date a transaction was auto-generated |
| is_active | INTEGER NOT NULL DEFAULT 1 | |
| created_at | TEXT NOT NULL | |

*Index: recurring_rules(investment_id)*

#### `import_batches`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| investment_type | TEXT NOT NULL | |
| filename | TEXT NOT NULL | |
| row_count | INTEGER NOT NULL DEFAULT 0 | |
| column_mapping | TEXT | nullable JSON |
| imported_at | TEXT NOT NULL | |

#### `sessions`
Created by the app at runtime (not in schema.sql).

| Column | Type | Notes |
|--------|------|-------|
| sid | TEXT | PRIMARY KEY |
| sess | TEXT NOT NULL | JSON session data |
| expired | INTEGER NOT NULL | Unix timestamp ms |

---

## 6. Entity Relationship Diagram

```mermaid
erDiagram
    users {
        int id PK
        text name
        text pin_hash
        text avatar
        int is_admin
    }

    settings {
        text key PK
        text value
    }

    investments {
        int id PK
        int user_id FK
        text investment_type
        text name
        text institution
        int is_active
    }

    investment_fd {
        int investment_id PK_FK
        int principal_paise
        real interest_rate
        text compounding
        text start_date
        text maturity_date
    }

    investment_rd {
        int investment_id PK_FK
        int monthly_installment_paise
        real interest_rate
        text start_date
        text maturity_date
    }

    investment_mf {
        int investment_id PK_FK
        text isin_code
        text scheme_code
        text scheme_name
        text folio_number
    }

    investment_shares {
        int investment_id PK_FK
        text ticker_symbol
        text exchange
        text demat_account
    }

    investment_gold {
        int investment_id PK_FK
        real weight_grams
        text purity
        int purchase_price_per_gram_paise
    }

    investment_loan {
        int investment_id PK_FK
        int principal_paise
        real interest_rate
        int emi_paise
        text start_date
    }

    investment_fixed_asset {
        int investment_id PK_FK
        int purchase_price_paise
        real inflation_rate
        text purchase_date
    }

    investment_pension {
        int investment_id PK_FK
        text pension_type
        real interest_rate
    }

    investment_savings_account {
        int investment_id PK_FK
        real interest_rate
        text bank_name
    }

    investment_transactions {
        int id PK
        int investment_id FK
        int user_id FK
        text txn_type
        text date
        int amount_paise
        real units
        int recurring_rule_id FK
        int import_batch_id FK
    }

    investment_lots {
        int id PK
        int investment_id FK
        int buy_txn_id FK
        real units_bought
        real units_remaining
        int cost_per_unit_paise
    }

    lot_sell_allocations {
        int id PK
        int sell_txn_id FK
        int lot_id FK
        real units_sold
        int cost_per_unit_paise
    }

    investment_overrides {
        int id PK
        int investment_id FK
        text override_date
        int value_paise
        int user_id FK
    }

    monthly_snapshots {
        int id PK
        int investment_id FK
        text year_month
        int invested_paise
        int current_value_paise
    }

    net_worth_snapshots {
        int id PK
        int user_id FK
        text year_month
        int net_worth_paise
        text breakdown_json
    }

    goals {
        int id PK
        int user_id FK
        text name
        int target_amount_paise
        text target_date
    }

    goal_investments {
        int goal_id FK
        int investment_id FK
        real allocation_percent
    }

    recurring_rules {
        int id PK
        int investment_id FK
        int user_id FK
        text frequency
        int amount_paise
        text last_generated
    }

    import_batches {
        int id PK
        text investment_type
        text filename
        int row_count
    }

    market_prices {
        int id PK
        text symbol
        text source
        text date
        int price_paise
    }

    gold_prices {
        int id PK
        text date
        int price_per_gram_paise
    }

    users ||--o{ investments : "owns"
    users ||--o{ investment_transactions : "creates"
    users ||--o{ goals : "defines"
    users ||--o{ net_worth_snapshots : "has"
    users ||--o{ recurring_rules : "has"
    users ||--o{ investment_overrides : "sets"

    investments ||--o| investment_fd : "detail (1:1)"
    investments ||--o| investment_rd : "detail (1:1)"
    investments ||--o| investment_mf : "detail (1:1)"
    investments ||--o| investment_shares : "detail (1:1)"
    investments ||--o| investment_gold : "detail (1:1)"
    investments ||--o| investment_loan : "detail (1:1)"
    investments ||--o| investment_fixed_asset : "detail (1:1)"
    investments ||--o| investment_pension : "detail (1:1)"
    investments ||--o| investment_savings_account : "detail (1:1)"

    investments ||--o{ investment_transactions : "has"
    investments ||--o{ investment_lots : "has"
    investments ||--o{ investment_overrides : "has"
    investments ||--o{ monthly_snapshots : "captured in"
    investments ||--o{ recurring_rules : "drives"
    investments }o--o{ goals : "via goal_investments"

    investment_transactions ||--o{ investment_lots : "creates (buy)"
    investment_lots ||--o{ lot_sell_allocations : "allocated via"
    investment_transactions ||--o{ lot_sell_allocations : "references (sell)"
    investment_transactions }o--o| recurring_rules : "generated by"
    investment_transactions }o--o| import_batches : "belongs to"

    goals ||--o{ goal_investments : "links"
    investments ||--o{ goal_investments : "assigned to"
```

---

## 7. API Reference

All endpoints require session authentication (`requireAuth`) except where noted. All request bodies and responses are JSON unless noted. All monetary values are in **paise** (integer).

### Authentication — `/api/auth`

| Method | Path | Auth | Request Body | Response | Notes |
|--------|------|------|-------------|----------|-------|
| GET | `/users` | None | — | `User[]` | List all users (for login screen) |
| POST | `/login` | None | `{userId, pin}` | `User` | Creates session |
| POST | `/logout` | None | — | `{ok: true}` | Destroys session |
| GET | `/me` | Yes | — | `User` | Current session user |
| POST | `/setup` | None | `{name, pin, avatar?}` | `User` | Create first admin; blocked if users exist |

### Users — `/api/users`

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| GET | `/` | — | `User[]` | |
| GET | `/:id` | — | `User` | |
| POST | `/` | `{name, pin, avatar?, is_admin?}` | `User` | Admin only |
| PUT | `/:id` | `{name?, avatar?, is_admin?}` | `User` | Own or admin |
| POST | `/:id/change-pin` | `{currentPin, newPin}` | `{ok}` | |
| DELETE | `/:id` | — | `{ok}` | Admin only |

### Investments — `/api/investments`

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| GET | `/` | — | `Investment[]` | Enriched with current_value, gain, xirr |
| GET | `/by-type/:type` | — | `Investment[]` | type = fd, rd, mf, mf_equity, etc. |
| GET | `/:id` | — | `Investment` | |
| POST | `/` | `{investment: {...}, detail: {...}}` | `Investment` | Auto-creates gold buy txn + RD recurring rule |
| PUT | `/:id` | `{investment?: {...}, detail?: {...}}` | `Investment` | |
| DELETE | `/:id` | — | `{ok}` | Cascades to all related data |
| POST | `/clear-all` | — | `{deleted: number}` | Deletes all for current user |
| POST | `/clear-by-type/:type` | — | `{deleted: number}` | `mf` deletes equity+hybrid+debt |
| POST | `/:id/override` | `{override_date, value_paise, reason?}` | `{ok}` | |
| GET | `/:id/overrides` | — | `InvestmentOverride[]` | |

### Transactions — `/api`

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| GET | `/investments/:id/transactions` | — | `InvestmentTransaction[]` | |
| GET | `/transactions` | — | `InvestmentTransaction[]` | All for user |
| POST | `/investments/:id/transactions` | `{txn_type, date, amount_paise, units?, price_per_unit_paise?, fees_paise?, notes?}` | `InvestmentTransaction` | Auto-creates lot for buy/sip |
| POST | `/investments/:id/sell` | `{date, units, price_per_unit_paise, fees_paise?, notes?}` | `{txn, allocations}` | FIFO lot allocation |
| GET | `/investments/:id/lots` | — | `InvestmentLot[]` | |
| PUT | `/transactions/:id` | `{txn_type?, date?, ...}` | `InvestmentTransaction` | |
| DELETE | `/transactions/:id` | — | `{ok}` | |
| POST | `/transactions/clear-all` | — | `{deleted: number}` | |

### Goals — `/api/goals`

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| GET | `/` | — | `Goal[]` with investments + progress |
| GET | `/:id` | — | `Goal` detail |
| POST | `/` | `{name, target_amount_paise, target_date, priority?, notes?}` | `Goal` |
| PUT | `/:id` | `{name?, target_amount_paise?, target_date?, priority?, notes?, is_active?}` | `Goal` |
| DELETE | `/:id` | — | `{ok}` |
| POST | `/:id/investments` | `{investment_id, allocation_percent}` | `{ok}` |
| DELETE | `/:id/investments/:investmentId` | — | `{ok}` |
| GET | `/:id/history` | — | `{actual, projected, ideal, target}` |
| POST | `/:id/simulate` | `{monthly_sip_paise?, expected_return_percent?}` | simulation result |

### Snapshots — `/api/snapshots`

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| POST | `/calculate` | `{snapshots_calculated: number}` | Uses current valuations |
| GET | `/net-worth` | `NetWorthSnapshot[]` | For net worth chart |
| POST | `/clear` | `{ok}` | Deletes all snapshots |
| POST | `/generate-historical` | `{started: true}` | Responds immediately; runs async |
| GET | `/job-status` | `JobStatus \| null` | Polls: running/completed/failed + error |
| GET | `/list` | summary[] | All months with snapshot data |
| GET | `/detail/:yearMonth` | `MonthlySnapshot[]` | Per-investment for a month |

### Analytics — `/api/analytics`

| Method | Path | Response |
|--------|------|----------|
| GET | `/dashboard` | `DashboardStats` |
| GET | `/net-worth-chart` | `{year_month, total_invested_paise, total_value_paise, net_worth_paise}[]` |
| GET | `/breakdown` | `InvestmentBreakdown[]` |
| GET | `/type-xirr/:type` | `{xirr: number \| null}` |
| GET | `/type-history/:type` | `{month, invested, value}[]` |

### Tax — `/api/tax`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/calculate` | `{fy_start, fy_end}` | `TaxSummary` |
| GET | `/gains` | — | `TaxSummary` (current FY: Apr 1 – Mar 31) |

### Market — `/api/market`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/fetch` | — | `{mf, stocks, gold}` counts |
| GET | `/price/:symbol` | `?source=mfapi\|yahoo\|manual` | `{date, price_paise}` |
| GET | `/gold` | — | `{date, price_per_gram_paise}` |
| GET | `/history/:symbol` | `?exchange=NSE\|BSE` | `{date, price_paise}[]` |
| POST | `/price` | `{symbol, date, price_paise}` | `{ok}` |
| POST | `/fetch-mf/:isinCode` | — | `{date, nav, price_paise}` |
| GET | `/mf/scheme/:schemeCode` | — | `{isin, scheme_name}` |
| GET | `/mf/search` | `?q=query` | `{schemeCode, schemeName}[]` |

### Recurring — `/api/recurring`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/` | — | `InvestmentRecurringRule[]` |
| GET | `/:id` | — | rule detail |
| POST | `/` | `{investment_id, txn_type, amount_paise, frequency, day_of_month?, start_date, end_date?, is_active?}` | rule |
| PUT | `/:id` | partial rule fields | updated rule |
| DELETE | `/:id` | — | `{ok}` |
| POST | `/generate` | — | `{generated: number}` |

### Settings — `/api/settings`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/type-rates` | — | `{rate_fd: 7, rate_mf_equity: 12, ...}` |
| PUT | `/type-rates` | `{rate_fd: number, ...}` | `{ok}` |
| POST | `/purge-all-data` | — | `{ok}` — deletes everything except users+settings |

### Import/Export — `/api`

| Method | Path | Content-Type | Request | Response |
|--------|------|-------------|---------|----------|
| POST | `/import/upload` | multipart/form-data | `{file: CSV, investment_type: string}` | `{created, transactions, errors[]}` |
| GET | `/export/template/:type` | — | — | `text/csv` download |
| GET | `/export/investments` | — | `?type=fd&...` | `text/csv` download |
| GET | `/export/transactions` | — | `?investment_id=123` | `text/csv` download |

---

## 8. Architectural Patterns

### 8.1 Polymorphic Investment Model

All investment types share a base `investments` table for common fields, with a 1:1 type-specific detail table per type. Three MF subtypes (`mf_equity`, `mf_hybrid`, `mf_debt`) share the same `investment_mf` detail table.

The mapping lives in `DETAIL_TABLES` in `investmentService.ts`:

```
mf_equity / mf_hybrid / mf_debt → investment_mf
fd → investment_fd
rd → investment_rd
shares → investment_shares
gold → investment_gold
loan → investment_loan
fixed_asset → investment_fixed_asset
pension → investment_pension
savings_account → investment_savings_account
```

All base + detail writes happen inside a `db.transaction()` to ensure atomicity. The `detail` field on `Investment` is a union of all detail types, populated at read time by joining the appropriate detail table.

### 8.2 Service Layer Pattern

```
HTTP Request
    → requireAuth middleware
    → validate(zodSchema) middleware (strips unknown fields, returns 400 on error)
    → Route handler (thin: 5–15 lines)
    → Service function (all business logic)
    → res.json(result)
```

Services call `getDb()` directly — there is no repository layer or dependency injection. Services are stateless modules of exported pure functions.

### 8.3 DatabaseWrapper Abstraction

`connection.ts` provides a better-sqlite3-compatible API over sql.js (SQLite in WebAssembly):

```typescript
db.prepare(sql).get(...params)      // → single row | undefined
db.prepare(sql).all(...params)      // → row[]
db.prepare(sql).run(...params)      // → { changes, lastInsertRowid }
db.transaction(fn)()                // → BEGIN ... COMMIT / ROLLBACK on throw
db.exec(sql)                        // → raw execution (migrations, DDL)
```

Every write (`run`, `exec`, `transaction`) calls `scheduleSave()`, which debounces a disk write 1 second. This means a burst of writes only triggers one disk write, but there is a ~1s window where in-memory state diverges from disk.

### 8.4 Valuation Pipeline

```
enrichInvestment(inv)
    → getCurrentValue(inv)              ← dispatches by investment_type
        → check investment_overrides     ← manual override takes precedence
        → FD/RD: compound interest formula
        → MF: getTotalUnits() × getCachedPrice(isin)
        → Shares: getTotalUnits() × getCachedPrice(ticker)
        → Gold: weight × goldPrice × purityFactor
        → Loan: calculateLoanOutstanding() (monthly amortization)
        → Fixed Asset: purchase_price × (1 + inflation)^years
        → Pension: total_deposits × (1 + rate)^years
        → Savings: sum of deposit transactions
    → getTotalInvested()                ← sum of buy/sip/deposit amounts
    → calculateXIRR(cashflows)          ← Newton-Raphson, max 100 iterations
```

### 8.5 FIFO Lot Tracking

For MF and shares only. Every `buy` or `sip` transaction creates a row in `investment_lots` with the full quantity. Every `sell` calls `executeSell()` which:

1. Queries `SELECT * FROM investment_lots WHERE investment_id = ? AND units_remaining > 0 ORDER BY buy_date ASC`
2. Deducts from oldest lots first
3. Writes `lot_sell_allocations` records for each lot consumed
4. Updates `units_remaining` on the lot

This enables per-lot cost basis for LTCG/STCG computation.

### 8.6 Financial Calculations

All formulas operate on **paise** (integer) inputs and outputs:

| Calculation | Formula |
|-------------|---------|
| FD compound interest | `A = P × (1 + r/n)^(n×t)` where n = periods/year, t = years elapsed |
| RD compound interest | Sum each monthly installment compounded from payment date to asOfDate |
| Loan outstanding | Monthly: `balance -= (EMI - balance × monthlyRate)` for each period |
| Asset appreciation | `value = purchase_price × (1 + inflation/100)^years` |
| Gold value | `value = weight_grams × price_per_gram × purityFactor` (24K=1.0, 22K≈0.917, 18K=0.75) |
| XIRR | Newton-Raphson on NPV=0; initial guess 10%; convergence < 1e-7; max 100 iterations |
| Pension | `value = total_deposits × (1 + rate/100)^years` (simplified) |

### 8.7 Snapshot System

```
monthly_snapshots     → per-investment (year_month + invested + value + gain)
net_worth_snapshots   → per-user aggregate (year_month + totals + breakdown_json)
```

`breakdown_json` stores a JSON object per investment type and goal:
```json
{
  "mf_equity": { "invested": 500000, "value": 620000, "count": 3, "gain": 120000, "gain_percent": 24.0, "xirr": 12.3 },
  "_goals": { "1": { "name": "Retirement", "value": 450000, "target": 5000000, "progress": 9.0 } }
}
```

**Historical generation** (async background job):
- Target date for each month = 1st of the month
- Loops 36 months backward + 10 calendar years backward
- Deletes existing snapshots for those months before regenerating
- Fetches historical MF NAVs (full history cached once per ISIN) and stock prices (1-year history)
- Yields event loop via `setImmediate` after every investment and after every XIRR computation to keep the server responsive

### 8.8 Background Job Pattern

The `POST /snapshots/generate-historical` endpoint responds immediately (`{ started: true }`) and runs the generation as a fire-and-forget Promise. Progress is tracked in an in-memory `Map<userId, JobStatus>` and exposed via `GET /snapshots/job-status`. The client polls every 2 seconds while status is `running`.

```
Client POST /generate-historical
    → Server responds { started: true } immediately
    → Server starts generateHistoricalSnapshots() in background
    → jobStatus.set(userId, { status: 'running', startedAt })

Client polls GET /job-status every 2s while data.status === 'running'
    → Server returns { status, startedAt, completedAt?, monthsProcessed?, error? }

On completion: jobStatus → { status: 'completed', monthsProcessed: 46 }
On failure:    jobStatus → { status: 'failed', error: "message" }
```

### 8.9 React Query Data Flow

```
Page component
    → useXxx() hook                         ← React Query useQuery / useMutation
        → xxxApi.method()                   ← Typed Axios call
            → axios instance → /api/...     ← Dev: Vite proxy to :3002
```

Query cache keys: `['investments']`, `['investments', 'type', 'fd']`, `['investments', 123]`, `['goals']`, `['snapshots', 'list']`, etc.

Mutations call `qc.invalidateQueries({ queryKey: [...] })` on success, causing dependent queries to refetch. Cross-domain invalidations (e.g., creating a transaction also invalidates `['investments']` to update enriched values) are handled in the mutation's `onSuccess`.

### 8.10 Authentication & Session

- **PIN-based**: 4–8 character PIN stored as bcrypt hash (10 rounds)
- **Session store**: Custom `SqliteSessionStore` in `app.ts` stores sessions in the `sessions` table, cleaned up every hour
- **Session cookie**: `httpOnly: true`, `sameSite: 'lax'`, `secure` controlled by `COOKIE_SECURE=true` env var
- **Auth flow**: GET /auth/users → user selection → PIN entry → POST /auth/login → session established
- **Setup gate**: POST /auth/setup only succeeds when `getUserCount() === 0`, creating the first admin user

### 8.11 Import/Export

**Import**:
1. Select investment type
2. Download template CSV (has header row + `# hint` row + `# example` row)
3. Upload populated CSV
4. Server: `parseCSV()` → filter `#` rows → `processImport()` loops rows → creates investments + transactions per row → returns `{created, transactions, errors[]}`
5. Sell transactions use FIFO via `executeSell()` with fallback to plain transaction
6. RD import auto-creates recurring rule with `last_generated` set to prevent duplicate future transactions

**Export**: Query DB → enrich with computed values → format as CSV → `Content-Disposition: attachment` response.

---

## 9. Design Decisions

### 9.1 sql.js Over Better-sqlite3 or Postgres

**Decision**: Use sql.js (SQLite in WebAssembly) instead of better-sqlite3 or a full database server.

**Rationale**:
- Self-hosted single-user app; no concurrent write contention
- sql.js is a pure JavaScript/WASM package — no native compilation required, works on any OS, trivial to deploy on AWS Elastic Beanstalk
- Database is a single file (`data/my-investments.db`) — easy backup, restore, and local development
- The 1-second debounce-save trades a tiny durability window for better write throughput during bulk imports

**Constraint**: sql.js does not support WAL mode, foreign key enforcement must be enabled per-connection, and every operation is synchronous WASM — making CPU-intensive loops block the event loop (see §11).

### 9.2 Paise as the Universal Monetary Unit

**Decision**: All monetary values stored and passed as integer paise (1 INR = 100 paise).

**Rationale**: Floating-point arithmetic on rupees causes precision errors in cumulative calculations (e.g., `10000 * 1.075` = `10750.000000000002` in IEEE 754). Integer paise avoids these errors entirely. The `*_paise` suffix naming convention makes the unit self-documenting.

**Constraint**: Requires consistent conversion at the client boundary (`InrAmount` component, `AmountInput` component) and in CSV import/export helpers.

### 9.3 Polymorphic Investment Model vs Separate Tables

**Decision**: Single `investments` base table + per-type detail tables (1:1), instead of one table per investment type or a single wide table.

**Rationale**:
- Single base table enables cross-type queries (e.g., "all active investments for user X") without UNIONs
- Separate detail tables maintain strict schemas per type (no nullable columns for irrelevant fields)
- Adding a new investment type requires only a new detail table (no schema changes to the base)

**Constraint**: Reads require a JOIN to the detail table; the `DETAIL_TABLES` mapping must be maintained.

### 9.4 One Goal per Investment

**Decision**: The system enforces that an investment can be assigned to at most one goal (even though the schema supports a many-to-many relationship via `goal_investments`).

**Rationale**: Prevents ambiguity in progress tracking. If an investment belongs to two goals, its value would double-count toward both. `allocation_percent` handles partial contribution within a single goal.

**Implementation**: `assignInvestment()` in `goalService.ts` first deletes any existing `goal_investments` row for the investment before inserting the new assignment.

### 9.5 Session-Based Auth (No JWT)

**Decision**: Express-session with SQLite store, not JWT.

**Rationale**: Single-domain self-hosted app; no need for stateless auth across microservices. Sessions are simpler to invalidate (just delete the row). No token refresh complexity.

**Constraint**: Requires sticky sessions or shared session store in multi-instance deployments. The current implementation is single-instance only.

### 9.6 Market Price Caching Strategy

**Decision**: Cache all historical NAV/price data in the `market_prices` table, not just the latest price.

**Rationale**: Historical snapshot generation needs prices on specific past dates. Fetching on-demand would require one API call per investment per month (46 × N calls). Caching the full history (mfapi.in returns all NAVs since inception, ~1500 entries) means one batch insert per fund, then all historical lookups hit the local DB.

**Implementation detail**: `fetchMFNavForDate()` checks cache first. On cache miss, fetches full history and batch-inserts in a single DB transaction (not row-by-row) to avoid blocking the event loop with thousands of WASM calls.

### 9.7 XIRR Computation Location

**Decision**: XIRR is computed server-side in `calculationService.ts` (Newton-Raphson in TypeScript), not via a native library or external service.

**Rationale**: Keeps the server dependency-free (no numpy/scipy bindings). Newton-Raphson is standard for XIRR and converges in < 20 iterations for normal cashflow scenarios.

**Constraint**: With large cashflow sets (e.g., 10 years of monthly SIPs = 120 entries), XIRR computation takes measurable CPU time. During historical snapshot generation, this is mitigated by yielding the event loop (`setImmediate`) after each XIRR computation.

### 9.8 Background Job Without a Task Queue

**Decision**: Historical snapshot generation is a fire-and-forget `Promise` with in-memory status tracking, not a proper task queue (Bull, BullMQ, etc.).

**Rationale**: Single-instance, single-user app. A full task queue would add Redis dependency and operational complexity disproportionate to the use case.

**Constraint**: Job status is lost on server restart. If the server crashes mid-generation, there is no automatic retry. Incomplete snapshots may exist in the DB.

### 9.9 Shared Zod Schemas

**Decision**: Validation schemas live in `shared/src/validators.ts`, consumed by both server middleware and client forms.

**Rationale**: Single source of truth for field names, types, and constraints prevents client/server schema drift.

**Constraint**: Zod `parse()` **strips unknown fields** by default. Every field a route handler accesses must be declared in the schema — omitting a field causes silent data loss (historically caused bugs with gold `weight_grams` and similar fields).

---

## 10. Conventions

### 10.1 Monetary Values

- Always stored and transmitted as **integer paise**
- Column/field names always suffixed with `_paise` (e.g., `amount_paise`, `principal_paise`)
- Client displays use `<InrAmount value={paise} />` → renders as `₹X,XX,XXX.XX`
- Client inputs use `<AmountInput value={paise} onChange={setPaise} />` which converts internally
- Import/export CSVs use rupees (human-friendly), converted at the boundary

### 10.2 Date Format

- All dates stored and transmitted as `YYYY-MM-DD` strings (ISO 8601 date only, no time)
- No `Date` objects in DB queries — string comparison works correctly for ISO dates (`'2025-03-01' < '2025-04-01'`)
- `today()` utility returns current date as `YYYY-MM-DD` in local timezone
- `year_month` columns use `YYYY-MM` format (e.g., `2025-03`)

### 10.3 Boolean Storage in SQLite

SQLite has no native boolean. Convention: `INTEGER NOT NULL DEFAULT 0` with values `0` (false) and `1` (true). Fields are cast to boolean in service functions before returning to API consumers.

### 10.4 File Naming

- Server routes: `server/src/routes/[domain].ts`
- Server services: `server/src/services/[domain]Service.ts`
- Client API: `client/src/api/[domain].ts`
- Client hooks: `client/src/hooks/use[Domain].ts`
- Client pages: `client/src/pages/[Domain]Page.tsx`

### 10.5 API Error Responses

All errors return JSON in the form:
```json
{ "error": "Human-readable message", "details": [...] }
```
- `400` — Validation failure (details = Zod issue array) or business logic violation
- `401` — Not authenticated
- `403` — Not authorized (admin required)
- `404` — Resource not found
- `500` — Unhandled server error

### 10.6 Query Keys (React Query)

| Query | Key |
|-------|-----|
| All investments | `['investments']` |
| Investments by type | `['investments', 'type', type]` |
| Single investment | `['investments', id]` |
| All goals | `['goals']` |
| Single goal | `['goals', id]` |
| Goal history | `['goals', id, 'history']` |
| Dashboard stats | `['analytics', 'dashboard']` |
| Net worth chart | `['analytics', 'net-worth']` |
| Breakdown | `['analytics', 'breakdown']` |
| Snapshots list | `['snapshots', 'list']` |
| Snapshot detail | `['snapshots', 'detail', yearMonth]` |
| Job status | `['snapshots', 'job-status']` |
| Tax gains | `['tax', 'gains']` |
| Recurring rules | `['recurring']` |
| Type rates | `['settings', 'type-rates']` |

### 10.7 Investment Type Constants

Investment types and their display labels are defined in `shared/src/enums.ts` as `InvestmentTypeLabels`:

```
fd → "Fixed Deposits"
rd → "Recurring Deposits"
mf_equity → "Mutual Funds (Equity)"
mf_hybrid → "Mutual Funds (Hybrid)"
mf_debt → "Mutual Funds (Debt)"
shares → "Shares"
gold → "Gold"
loan → "Loans"
fixed_asset → "Fixed Assets"
pension → "Pension"
savings_account → "Savings Accounts"
```

Chart colors for types are defined in `client/src/lib/constants.ts` as `CHART_COLORS`.

---

## 11. Constraints & Limitations

### 11.1 Single-Threaded Event Loop Blocking

sql.js runs SQLite as synchronous WASM calls. CPU-intensive loops (historical snapshot generation, bulk imports, XIRR with large cashflow sets) can block the Node.js event loop and make the server temporarily unresponsive.

**Mitigation in place**: `setImmediate` yields are inserted between every investment and after every XIRR computation during historical snapshot generation. Bulk DB inserts use `db.transaction()` (single WASM call) instead of individual `run()` calls.

**Known remaining risk**: Very large portfolios (50+ investments) with many years of transaction history could still cause multi-second blocks in some operations.

### 11.2 No Foreign Key Enforcement

SQLite foreign keys are disabled by default and must be enabled per-connection with `PRAGMA foreign_keys = ON`. The current codebase does not enable this pragma, so `ON DELETE CASCADE` declarations in the schema are inert. Deletes must be performed in the correct dependency order in application code.

**Risk**: Orphaned records possible if delete operations are incomplete. Delete sequences in services must explicitly delete child tables before parent.

### 11.3 In-Memory Database with Durability Window

sql.js holds the entire database in memory. Disk persistence happens via a 1-second debounced `saveToDisk()`. If the process crashes within that window, up to 1 second of writes may be lost.

**Risk**: Low for personal use. Not suitable for high-frequency trading data.

### 11.4 Market Data Reliability

MF NAVs come from mfapi.in (unofficial), stock prices from Yahoo Finance query API (undocumented). Both APIs may change or go down without notice. Gold prices are derived from XAUUSD via Yahoo Finance with a hardcoded USD/INR rate (~84).

**Constraint**: No fallback data provider. Historical prices before the first cache miss are unavailable for new investments.

### 11.5 Single Instance Only

Session state, in-memory job status (`Map<userId, JobStatus>`), and the sql.js in-memory database are all process-local. Running multiple server instances (horizontal scaling, blue-green deploys) would cause data inconsistency.

### 11.6 Tax Calculation Simplifications

- Short-term capital gains rate for debt is approximated at 30% (actual rate depends on individual income tax slab)
- No TDS, surcharge, or cess beyond the 4% cess already baked into equity LTCG rate
- Bonus transactions and stock splits are not included in LTCG/STCG computation
- Debt LTCG threshold (>3 years) is not implemented; all debt gains use the equity holding period rule (>365 days)

### 11.7 Goal One-to-One Constraint

Each investment can belong to at most one goal. This prevents a portfolio where one FD is partially funding two different goals. Workaround: split the investment into two separate investments.

### 11.8 No Real-Time Market Data

Market prices are fetched on-demand or on a 24-hour schedule (`fetchAllMarketData()`). Intraday price changes are not tracked; the last fetched price is used for all valuations until the next fetch.

### 11.9 Background Job Persistence

The historical snapshot job status is held in a `Map` in the route module scope. This map is lost on server restart. If the server restarts mid-generation, the job status will be `null` and partial snapshots may be present in the DB.

---

*Last updated: 2026-02-23*
*See also: [Architectural Patterns](.claude/docs/architectural_patterns.md) for quick-reference pattern summaries.*
