# Architectural Patterns

Patterns and conventions that appear across multiple files in this codebase.

## Polymorphic Investment Model

A single `investments` table holds common fields (name, type, user_id, is_active). Each `investment_type` has a corresponding detail table (e.g., `investment_fd`, `investment_mf`, `investment_gold`). The mapping lives in `DETAIL_TABLES` at `server/src/services/investmentService.ts:4`.

- MF types (`mf_equity`, `mf_hybrid`, `mf_debt`) all map to the same `investment_mf` detail table
- When creating/updating, the service writes to both the base and detail tables in a transaction
- `enrichInvestment()` at `server/src/services/valuationService.ts:69` joins base + detail + computed values

## Service Layer Pattern

All business logic lives in `server/src/services/`. Route handlers are thin wrappers:

```
Route handler → validate(schema) middleware → service function → JSON response
```

Services import `getDb()` from `server/src/db/connection.ts:167` directly — there is no dependency injection or repository layer. Each service file is a module of exported functions (no classes).

Referenced in: `server/src/routes/*.ts` (all route files follow this pattern).

## Zod Validation Pipeline

Shared Zod schemas in `shared/src/validators.ts` are used by:
1. **Server**: `validate()` middleware at `server/src/middleware/validate.ts:4` calls `schema.parse()` on `req.body`
2. **Client**: Form validation before API calls

Key behavior: Zod's `.parse()` **strips unknown fields** by default. Any field the route handler accesses must be explicitly declared in the schema, or it will be silently dropped. This caused a bug with gold `weight_grams` being stripped before the handler could process it.

## Paise Convention

All monetary values use integer paise (1 rupee = 100 paise) to avoid floating-point arithmetic issues.

- Database columns: `*_paise` suffix (e.g., `amount_paise`, `principal_paise`, `emi_paise`)
- API request/response: same `*_paise` fields
- Client display: `<InrAmount>` component at `client/src/components/InrAmount.tsx` formats paise to rupee display
- Calculations in `server/src/services/calculationService.ts` operate on paise values directly

## React Query Data Flow

Client data fetching follows a three-layer pattern:

```
Page component → useXxx() hook → xxxApi.method() → axios → /api/...
```

- **API layer** (`client/src/api/*.ts`): Raw axios calls, one file per domain
- **Hook layer** (`client/src/hooks/*.ts`): React Query `useQuery`/`useMutation` wrappers with cache keys, invalidation
- **Page layer** (`client/src/pages/*.tsx`): Consumes hooks, renders UI

Cache invalidation: mutations call `queryClient.invalidateQueries()` with the relevant key to refetch stale data. Query keys follow `['resource-name']` or `['resource-name', id]` convention.

## Investment Card Pattern

Each investment type page (FD, RD, MF, Shares, Gold, etc.) follows the same structure:

1. Page component fetches investments filtered by type via `useInvestments(type)`
2. Renders a list of `XxxCard` components (one per investment)
3. Each card shows: summary stats, detail fields, transaction list, action buttons (edit, delete, add transaction)
4. Add/edit forms use shadcn Dialog components with controlled state

Referenced in: `client/src/pages/FDPage.tsx`, `MutualFundsPage.tsx`, `GoldPage.tsx`, etc.

## DatabaseWrapper Abstraction

`server/src/db/connection.ts:55` wraps sql.js to provide a better-sqlite3-compatible API:

- `db.prepare(sql).get(...params)` → single row or undefined
- `db.prepare(sql).all(...params)` → array of rows
- `db.prepare(sql).run(...params)` → `{ changes, lastInsertRowid }`
- `db.transaction(fn)` → wraps in BEGIN/COMMIT/ROLLBACK
- All write operations schedule a debounced disk save (1-second timer)

sql.js runs SQLite in-memory via WebAssembly. The wrapper serializes to disk at `data/my-investments.db`.

## Valuation by Type

`getCurrentValue()` at `server/src/services/valuationService.ts:8` dispatches valuation by `investment_type`:

| Type | Valuation Method |
|------|-----------------|
| FD/RD | Compound interest formula to today |
| MF/Shares | `totalUnits * latestMarketPrice` |
| Gold | `weightGrams * goldPrice * purityFactor` |
| Loan | Principal minus amortized payments |
| Fixed Asset | Purchase price * inflation appreciation |
| Pension | Sum of deposits + compound interest |
| Savings | Latest balance from transactions |

Manual overrides (stored in `investment_overrides` table) take precedence over computed values.

## FIFO Lot Tracking

For MF and shares, buy transactions create lots in `investment_lots`. Sell transactions allocate against the oldest unsold lots via `lot_sell_allocations`. This enables per-lot gain/loss calculation.

Key functions in `server/src/services/transactionService.ts`:
- `addTransaction()` — creates lot on buy, allocates on sell
- `getTotalUnits()` — sums remaining units across all lots
- `getLots()` — returns lots with remaining quantity

## Goal Projection

Goals link to investments via `goal_investments` (many-to-many with allocation %). Goal tracking computes three data series:

1. **Actual**: Historical monthly values from `monthly_snapshots`
2. **Projected**: Future compound growth from current value using weighted average returns
3. **Ideal**: Compound growth curve showing required monthly contribution path from start to target

Logic in `server/src/services/goalService.ts:134` (`getGoalHistory()`).

## Snapshot System

Two snapshot tables provide historical tracking:

- `monthly_snapshots`: Per-investment monthly values (investment_id, year_month, invested_paise, value_paise)
- `net_worth_snapshots`: Aggregate monthly totals (user_id, year_month, total_invested, total_value)

Snapshots are created by `server/src/services/snapshotService.ts`. Historical generation computes past values using type-specific valuation with date-filtered transactions and cached market data.

## Session Auth

PIN-based authentication with bcrypt hashing. Sessions stored in SQLite `sessions` table via custom `SqliteSessionStore` at `server/src/app.ts:88`. The `requireAuth` middleware at `server/src/middleware/auth.ts` checks `req.session.userId` and attaches user to request.

No JWT, no OAuth. Single-user or family use case with PIN-based user switching.

## Market Data Caching

External market data is fetched and cached in the database:

- **MF NAV**: `mfapi.in` API → `market_prices` table (source: 'mfapi')
- **Stock prices**: Yahoo Finance → `market_prices` table (source: 'yahoo')
- **Gold prices**: External API → `gold_prices` table

Cache lookup checks `market_prices` for recent data before making external calls. Manual price overrides use source 'manual'. See `server/src/services/marketDataService.ts`.
