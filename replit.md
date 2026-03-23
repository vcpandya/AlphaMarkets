# AlphaMarkets

AI-powered market intelligence platform that finds hidden-gem stock insights through multi-step causation chain analysis.

## Architecture

This is a monorepo with two workspaces:

- **`client/`** — React 19 + Vite 7 + TypeScript + Tailwind CSS 4 frontend
- **`server/`** — Express 5 + TypeScript + PostgreSQL backend

### Frontend (client/)
- React Router for navigation
- D3.js for interactive network/flow visualizations
- React Markdown + KaTeX for rendered content
- Tailwind CSS 4 (via Vite plugin)
- Runs on port **5000** in dev

### Backend (server/)
- Express 5 REST API on port **3001**
- PostgreSQL database via `pg` (Replit-managed, `DATABASE_URL` env var)
- JWT auth with bcryptjs (cookie-based)
- Background scheduler for periodic news fetching
- Routes: `/api/auth`, `/api/news`, `/api/analysis`, `/api/models`, `/api/env-keys`, `/api/content`, `/api/storage`, `/api/share`
- Share links: `/api/share` (POST create, GET read public, POST verify password, DELETE revoke). Stored in `shared_runs` table with optional bcrypt password and expiry timestamp.
- External integrations: OpenRouter (LLMs), Jina (web scraping), AlphaVantage (stock data), AgentMail (via Replit connector, fixed mailbox omni@agentmail.to)

## Dev Workflows

- **Start application** — `npm run dev -w client` (webview, port 5000)
- **Backend** — `npm run dev -w server` (console, port 3001)

Frontend proxies `/api/*` to `http://localhost:3001` in dev mode.

## Production

Deployment target: **autoscale** (Replit PostgreSQL is external, so stateless autoscale is fine)
Build: `npm run build` (builds both client and server TypeScript)
Run: `NODE_ENV=production node server/dist/index.js` — serves static client from `client/dist/` and API on port 3001.

## Package Management

Uses npm workspaces. Install from root: `npm install`

## Default Admin

On first PostgreSQL init, a default admin user is seeded:
- Username: `admin`, Password: `admin123`
- Change the password immediately after first login.

## Key Files

- `client/vite.config.ts` — Vite dev server config (host, port, proxy)
- `server/src/index.ts` — Express app entry point
- `server/src/services/pgStorage.ts` — PostgreSQL database layer (replaces SQLite)
- `server/src/services/scheduler.ts` — Background news scheduler
