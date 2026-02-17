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
