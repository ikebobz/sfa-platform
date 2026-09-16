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
  common/              api-error.ts, http.ts, pagination.ts, audit.ts
  middleware/          auth.middleware.ts (JWT + RBAC)
  db/
    migrations/        One file per table group, in dependency order
    seeds/              Sample data for dev/demo
  modules/
    auth/               login, refresh, /me
    users/              admin CRUD over the user directory
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
```

## Key design decisions worth knowing about

- **The sales→ledger→stock update is one DB transaction** (`src/modules/sales/sales.routes.ts`). If any part fails, the whole sale is rolled back — this was called out as critical in the original design spec and is the part most worth reviewing/testing carefully before going live.
- **RBAC is enforced in middleware and per-module scoping helpers**, not just hidden in the UI. A rep's JWT carries their territory; customer/visit-plan/sales queries are filtered server-side by that territory (or by region, for RSMs) so a compromised or modified mobile client still can't read another territory's data. The shared scoping logic lives in `src/common/scope.ts` (`visibleTerritoryIds`) and is used by the customers and visit-plans modules — apply the same helper to any new module that lists rep-owned data (sales, expenses, visit-logs currently still take an explicit `?repId=` without this scoping; tightening those the same way is a good next step).
- **`GET /users/directory`** is a deliberately narrow, name-only endpoint (id, name, territory) for RSM/NSM/admin to populate "filter by rep" dropdowns, so the frontend doesn't need full admin user-management access just to build a filter.
- **Soft deletes** (`deleted_at`) are used on master-data tables (users, territories, products, customers) so historical sales/expenses never end up pointing at a hard-deleted row.
- **Incentive and expense-limit thresholds are hardcoded constants** near the top of their respective route files (clearly commented) — move these into a settings table once the organisation confirms the actual payout/limit rules, rather than guessing them here.
- **Audit logging** (`audit_log` table) is wired into user, territory, product, and expense-approval writes. Extend it to any other endpoint your compliance needs require.

## What's not yet built (next steps for whoever picks this up)

- Automated tests beyond the one sales-transaction integration test included as a template (`src/modules/sales/sales.integration.test.ts`) — extend this pattern to the other modules.
- CSV/PDF export endpoints (`GET /reports/...`) mentioned in the design spec.
- Password reset flow (`/auth/forgot-password`).
- Rate limiting on auth endpoints.
- OpenAPI/Swagger documentation generation.
- A settings/config table for the currently-hardcoded incentive and expense thresholds.
- Wiring this up to the web app and Flutter mobile app (neither is included in this scaffold yet).

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
