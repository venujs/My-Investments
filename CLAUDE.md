# My Investments

Personal investment portfolio tracker. Tracks FDs, RDs, mutual funds, shares, gold, loans, fixed assets, pension, and savings accounts with valuation, goals, tax computation, and snapshot-based analytics.

## Tech Stack

- **Monorepo**: npm workspaces — `shared/`, `server/`, `client/`
- **Server**: Express.js + TypeScript, sql.js (in-memory SQLite with disk persistence)
- **Client**: React 19 + Vite, TanStack React Query, shadcn/ui, Recharts, Tailwind CSS
- **Shared**: Zod validators + TypeScript types consumed by both server and client
- **Auth**: Session-based with bcrypt PIN hashing (no JWT)

## Commands

```bash
npm run dev          # Start server (3001) + client (5173) concurrently
npm run build        # Build shared → client → server (order matters)
npm run start        # Production server (serves client/dist)
```

Individual workspace commands: `npm run dev -w server`, `npm run build -w client`, etc.

## Key Directories

```
shared/src/
  types.ts           — All TypeScript interfaces (Investment, Goal, etc.)
  validators.ts      — Zod schemas used by both server validation and client forms

server/src/
  app.ts             — Express setup, session store, route mounting at /api/*
  db/connection.ts   — sql.js DatabaseWrapper (prepare/exec/transaction), disk save on timer
  db/schema.sql      — Full SQLite schema (investments + 11 detail tables, lots, snapshots)
  services/          — Business logic layer (one service per domain)
  routes/            — Express route handlers (thin: validate → service → respond)
  middleware/        — auth.ts (requireAuth), validate.ts (Zod), errorHandler.ts

client/src/
  api/               — Axios-based API functions (one file per domain)
  hooks/             — React Query hooks wrapping API calls
  pages/             — One page component per route
  components/ui/     — shadcn/ui primitives
  components/layout/ — AppShell, Sidebar, MobileNav
  contexts/          — AuthContext (session management)
  lib/utils.ts       — cn() helper (clsx + tailwind-merge)
```

## Database

SQLite via sql.js, stored at `data/my-investments.db`. The `DatabaseWrapper` in `server/src/db/connection.ts:55` wraps sql.js to provide a better-sqlite3-like API (`prepare().get()`, `.all()`, `.run()`). Writes are debounce-saved to disk every 1 second.

Schema uses a polymorphic investment model: base `investments` table + type-specific detail tables (e.g., `investment_fd`, `investment_mf`). Mapped via `DETAIL_TABLES` in `server/src/services/investmentService.ts:4`.

## Money

All monetary values are stored as **paise** (integer, 1 rupee = 100 paise) to avoid floating-point errors. Field naming convention: `*_paise` (e.g., `amount_paise`, `principal_paise`). The client's `<InrAmount>` component handles paise→rupee display formatting.

## API Pattern

All routes are prefixed with `/api/`. Route handlers follow: parse session user → call service function → return JSON. Validation uses `validate()` middleware (`server/src/middleware/validate.ts`) which runs `zodSchema.parse()` — Zod strips unknown fields by default, so any field the route handler needs must be in the schema.

## Market Data

MF NAV from mfapi.in, stock prices from Yahoo Finance. Cached in `market_prices` table. Gold prices cached in `gold_prices` table. See `server/src/services/marketDataService.ts`.

## Valuation

`server/src/services/valuationService.ts:8` — `getCurrentValue()` switches on `investment_type` to compute current value. `enrichInvestment()` adds computed fields (total invested, current value, gain, XIRR). Financial math (compound interest, XIRR via Newton-Raphson) lives in `server/src/services/calculationService.ts`.

## FIFO Lot Tracking

MF and shares use FIFO lot tracking via `investment_lots` and `lot_sell_allocations` tables. Buy creates a lot; sell allocates against oldest lots. Managed in `server/src/services/transactionService.ts`.

## Snapshots

Monthly valuation snapshots stored in `monthly_snapshots` (per-investment) and `net_worth_snapshots` (aggregate). Used for goal tracking charts and net worth history. Logic in `server/src/services/snapshotService.ts`.

## Additional Documentation

- [Architectural Patterns](.claude/docs/architectural_patterns.md) — Cross-cutting patterns, conventions, and design decisions
