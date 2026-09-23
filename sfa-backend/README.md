# SFA Platform — Backend API

REST API for the Sales Force Automation Platform (replacing the Excel territory-tracking workbook). Built with **Express + TypeScript + Knex + MariaDB**.

## A note on scope and one deliberate deviation

The original implementation prompt suggested NestJS (or Laravel) with Prisma/TypeORM. This scaffold uses **Express + Knex** instead — a lighter-weight, equally production-viable stack that was faster to hand-write correctly in full without a live environment to test against. All business logic, schema, and API contracts follow the original spec exactly; only the framework choice differs. If your team has a strong NestJS preference, the module boundaries here (one folder per domain, a `.routes.ts` file per module) map directly onto NestJS controllers/services/modules and can be ported in an afternoon.

This is a working scaffold covering the core flows end-to-end (auth, master data, planning/visits, the sales→ledger→stock transaction, expenses with approvals, incentive calculation, and the dashboard aggregate), not a finished, fully-tested product. Treat it as the foundation to build the remaining edge cases, tests, and polish on top of — ideally in **Claude Code**, where it can actually be installed, run against a real MariaDB instance, and iterated on.

## Requirements

- Node.js 20+
- Docker (for local MariaDB) — or your own MariaDB 10.11+/11.x instance

## Setup

```bash
cp .env.example .env
# edit .env if you're not using the default docker-compose credentials

npm install

# start MariaDB locally
docker compose up -d mariadb

# run migrations and seed sample data
npm run migrate
npm run seed

# start the API in dev mode (auto-reload)
npm run dev
```

The API will be listening on `http://localhost:4000`. Health check: `GET /health`.

## Running migrations against the *containerized* API (production-style)

The steps above run `npm run migrate`/`npm run seed` from your host machine, against a MariaDB container but with a normal full `npm install` — this works because your host has `ts-node` available to load the TypeScript migration files directly.

If instead you're running the **built** API container (`docker compose up -d` with no `mariadb`-only flag, or a real deployment), migrations must be run *inside* that container instead, because the production image deliberately has no `ts-node`/`typescript` installed:

```bash
docker compose up -d
docker compose exec api npm run migrate
docker compose exec api npm run seed   # optional — sample data, not needed in real production
```

This works because `knexfile.js` is environment-aware: inside the container `NODE_ENV=production` (set in `docker-compose.yml`), so it points at the already-compiled `dist/db/migrations`/`dist/db/seeds` (built by `npm run build` in the Dockerfile) instead of the TypeScript source. Getting this wrong — e.g. `NODE_ENV` drifting out of sync with which build of the image is actually running — is exactly the kind of thing that works fine in local dev and only breaks the first time someone deploys for real, so if you change `NODE_ENV` handling anywhere, re-check this path.

Seeded login (see `src/db/seeds/001_sample_data.ts`):
- `admin@example.com` / `ChangeMe123!` (admin)
- `batho.adobeze@example.com` / `ChangeMe123!` (rep)
- (and a few others — see the seed file)

**Change these passwords, secrets, and the DB credentials before any real deployment.**

## Project structure

```
src/
  app.ts               Express app + route mounting
  server.ts            Entry point
  config/              env.ts, db.ts (Knex singleton)
  common/              api-error.ts, http.ts, pagination.ts, audit.ts, scope.ts (RBAC territory helpers), csv.ts (export serialization)
  middleware/          auth.middleware.ts (JWT + RBAC)
  db/
    migrations/        One file per table group, in dependency order
    seeds/              Sample data for dev/demo
  modules/
    auth/               login, refresh, /me
    users/              admin CRUD over the user directory, plus GET /users/directory (RSM/NSM/admin, name-only)
    territories/        admin CRUD
    products/           admin CRUD, listable by all authenticated roles
    customers/          territory-scoped CRUD (rep sees own territory, RSM sees region, admin/nsm see all)
    visit-plans/        daily call planning
    visit-logs/         actual field visits (marks plans completed, bumps last_visit_date)
    sales/              records a sale; ATOMICALLY updates ledger_entries and stock_daily in one DB transaction
    ledger/             read-only balance + credit-risk views (the "Debt Analysis" equivalent)
    expenses/           capture + RSM/admin approval workflow, flags month-to-date over-limit spend
    stock/              read-only view of stock_daily (populated by sales & expenses)
    incentives/         commission calculation from actual sales revenue per rep/period
    invoices/           office invoice records
    dashboard/          the KPI aggregate endpoint replicating the Excel Dashboard tab
    reports/            CSV export endpoints (customers, sales, expenses, debt-analysis), RSM/NSM/admin only
```

## Key design decisions worth knowing about

- **The sales→ledger→stock update is one DB transaction** (`src/modules/sales/sales.routes.ts`). If any part fails, the whole sale is rolled back — this was called out as critical in the original design spec and is the part most worth reviewing/testing carefully before going live.
- **RBAC is enforced in middleware and per-module scoping helpers**, not just hidden in the UI. A rep's JWT carries their territory; customer/visit-plan/visit-log/sales/expenses queries are filtered server-side by that territory (or by region, for RSMs) so a compromised or modified mobile client still can't read another territory's data. The shared scoping logic lives in `src/common/scope.ts` (`visibleTerritoryIds`) and is now used by every module that lists rep-owned data: customers, visit-plans, visit-logs, sales, and expenses.
- **A rep can only act on customers in their own territory** — enforced consistently on customer creation, sale recording, and visit logging.
- **`GET /incentives`** applies the same territory/region scoping as every other rep-owned-data module and joins through `rep_name`/`product_name`.
- **`GET /users/directory`** is a deliberately narrow, name-only endpoint (id, name, territory) for RSM/NSM/admin to populate "filter by rep" dropdowns, so the frontend doesn't need full admin user-management access just to build a filter.
- **`common/scope.ts`** also exports `resolveTerritoryFilter(user, requestedTerritoryId?)`, used by the reports and ledger/dashboard modules: it validates an explicitly-requested `?territoryId=` against what the user is actually allowed to see and throws a 403 if they ask for something outside their scope, rather than silently ignoring the request or silently narrowing it. Use this (not a raw query param) anywhere a manager can pass an explicit territory filter.
- **Dashboard and ledger scoping was tightened**, not just the list endpoints: `GET /dashboard/overview` previously computed expenses and debt totals with no territory scoping at all regardless of role, and accepted any `?territoryId=` without checking it was within the caller's allowed scope — both fixed. `GET /ledger/debt-analysis` and `GET /ledger/customers/:id` got the equivalent fix. This matters more than the list-endpoint fixes in practice, since the dashboard is the default landing screen every manager sees first.
- **Report exports** (`src/modules/reports/reports.routes.ts`) are CSV-only for now (no PDF), RSM/NSM/admin only, and reuse the exact same territory scoping — a report a manager downloads can never contain rows outside what they could already see in the app.
- **`knexfile.js` (not `.ts`)** is environment-aware: it points at `src/db/*` with a `.ts` extension in development (loaded via `ts-node`, a devDependency) and at the compiled `dist/db/*` with a `.js` extension when `NODE_ENV=production`. This exists because the production Docker image intentionally strips `ts-node`/`typescript` via `npm install --omit=dev` — without this split, running migrations *inside the built container* would fail outright with no way to load the TypeScript migration files. This was a real, previously-unfixed gap: local development never exercised the production image's migration path, so it looked fine until someone actually tried to deploy it.
- **`docker-compose.yml` sources secrets from `.env`** via `env_file:`, rather than hardcoding a real (if clearly-fake-looking) JWT secret and DB password directly in the compose file. It also pins the `api` service's `NODE_ENV` to `production` explicitly — the Dockerfile's only build target is its production stage, so anything else there would silently break the migrations path described above.
- **Soft deletes** (`deleted_at`) are used on master-data tables (users, territories, products, customers) so historical sales/expenses never end up pointing at a hard-deleted row.
- **Incentive and expense-limit thresholds are hardcoded constants** near the top of their respective route files (clearly commented) — move these into a settings table once the organisation confirms the actual payout/limit rules, rather than guessing them here.
- **Audit logging** (`audit_log` table) is wired into user, territory, product, and expense-approval writes. Extend it to any other endpoint your compliance needs require.

## What's not yet built (next steps for whoever picks this up)

- Automated tests beyond the one sales-transaction integration test included as a template (`src/modules/sales/sales.integration.test.ts`) — extend this pattern to the other modules, and especially to the scoping logic in `common/scope.ts` now that several modules depend on it.
- PDF export (reports are CSV-only for now).
- Password reset flow (`/auth/forgot-password`).
- Rate limiting on auth endpoints.
- OpenAPI/Swagger documentation generation.
- A settings/config table for the currently-hardcoded incentive and expense thresholds.
- Wiring this up to the Flutter mobile app (not included in this scaffold yet).

All six rep-owned-data list endpoints (customers, visit-plans, visit-logs, sales, expenses, incentives), the dashboard aggregate, the ledger/debt views, and the report exports now share the same territory/region RBAC scoping — that class of gap is closed across the entire module set as it currently stands.

## Useful commands

```bash
npm run migrate           # apply all pending migrations
npm run migrate:rollback  # roll back the last migration batch
npm run migrate:make <name>  # scaffold a new migration file
npm run seed               # re-run seed data (destructive — clears and reseeds)
npm test                   # run the Jest test suite (needs a running MariaDB)
npm run build && npm start # production build + run
docker compose up -d       # run MariaDB + the containerized API together
```
