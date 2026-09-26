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
    territories/        admin CRUD for writes; reads scoped by territory/region like everything else (a rep sees only their own, an RSM their region, NSM/admin everyone)
    products/           admin CRUD, listable by all authenticated roles
    customers/          territory-scoped CRUD (creation is rep-only; RSM/NSM/admin have read access across their scope, but cannot add new customers)
    visit-plans/        daily call planning
    visit-logs/         actual field visits — customer, date, free-text notes, structured activities carried out (product detailing, sample drop, order placed, etc.), and which products were discussed; marks the linked plan completed and bumps the customer's last_visit_date
    sales/              rep-only; records a sale, ATOMICALLY updates ledger_entries, stock_daily, AND stock_balances (depleting on-hand stock) in one DB transaction
    ledger/             read-only balance + credit-risk views (the "Debt Analysis" equivalent)
    expenses/           capture + RSM/admin approval workflow, flags month-to-date over-limit spend
    stock/              stock_daily read-only view (populated by sales/expenses), PLUS rep-only stock receipts (logging what arrived from the office) and on-hand balance tracking that depletes as sales are recorded
    incentives/         commission calculation from actual sales revenue per rep/period
    invoices/           office invoice records
    dashboard/          the KPI aggregate endpoint replicating the Excel Dashboard tab, including new-customers-in-period and sales-count for a caller-supplied date range, PLUS /rep-targets: new customers per rep vs. a configurable target for the current day/week/month/quarter
    reports/            CSV export endpoints (customers, sales, expenses, debt-analysis), RSM/NSM/admin only
    targets/            admin/NSM only — set/view periodic targets (currently just "new customers"), globally or per rep, per period type
```

## Key design decisions worth knowing about

- **The sales→ledger→stock update is one DB transaction** (`src/modules/sales/sales.routes.ts`). If any part fails, the whole sale is rolled back — this was called out as critical in the original design spec and is the part most worth reviewing/testing carefully before going live.
- **RBAC is enforced in middleware and per-module scoping helpers**, not just hidden in the UI. A rep's JWT carries their territory; customer/visit-plan/visit-log/sales/expenses queries are filtered server-side by that territory (or by region, for RSMs) so a compromised or modified mobile client still can't read another territory's data. The shared scoping logic lives in `src/common/scope.ts` (`visibleTerritoryIds`) and is now used by every module that lists rep-owned data: customers, visit-plans, visit-logs, sales, expenses, incentives, stock, and — as of this round — territories itself. `GET /territories` was, for a long time, the one list endpoint in the whole backend that had been missed: any authenticated rep could call it directly and see every territory in the organisation, even though the customer-creation form's dropdown only ever displayed their own. Fixed the same way as everything else.
- **A rep can only act on customers in their own territory** — enforced consistently on customer creation, sale recording, and visit logging.
- **`GET /incentives`** applies the same territory/region scoping as every other rep-owned-data module and joins through `rep_name`/`product_name`.
- **`GET /users/directory`** is a deliberately narrow, name-only endpoint (id, name, territory) for RSM/NSM/admin to populate "filter by rep" dropdowns, so the frontend doesn't need full admin user-management access just to build a filter.
- **`common/scope.ts`** also exports `resolveTerritoryFilter(user, requestedTerritoryId?)`, used by the reports and ledger/dashboard modules: it validates an explicitly-requested `?territoryId=` against what the user is actually allowed to see and throws a 403 if they ask for something outside their scope, rather than silently ignoring the request or silently narrowing it. Use this (not a raw query param) anywhere a manager can pass an explicit territory filter.
- **Dashboard and ledger scoping was tightened**, not just the list endpoints: `GET /dashboard/overview` previously computed expenses and debt totals with no territory scoping at all regardless of role, and accepted any `?territoryId=` without checking it was within the caller's allowed scope — both fixed. `GET /ledger/debt-analysis` and `GET /ledger/customers/:id` got the equivalent fix. This matters more than the list-endpoint fixes in practice, since the dashboard is the default landing screen every manager sees first.
- **Report exports** (`src/modules/reports/reports.routes.ts`) are CSV-only for now (no PDF), RSM/NSM/admin only, and reuse the exact same territory scoping — a report a manager downloads can never contain rows outside what they could already see in the app.
- **Only reps can add customers or record sales** — both are `requireRole("rep")`. Managers retain read access across their scope (and can still edit an existing customer), but field data entry — meeting a new business, making a sale — is deliberately a rep-only action, matching how the original Excel workbook was actually used in the field.
- **Stock on hand is tracked per rep, per product, and enforced, not just displayed.** A rep logs a receipt (`POST /stock/receipts`) when the office hands them stock, which increments `stock_balances`. Recording a sale decrements the same balance, in the same DB transaction as the sale itself (`adjustStockBalance` in `src/modules/stock/stock.service.ts`). If a sale would take a rep's balance for that product below zero, the whole transaction — sale, ledger update, stock_daily roll-up, everything — rolls back with a 400, not just a warning. This was a deliberate choice over a softer "allow but flag" approach: a rep genuinely cannot sell units they don't have, so the constraint is real, not advisory. If a data-entry backlog ever needs the balance corrected without a real receipt, that has to go through a new admin-only "correcting entry" endpoint — there isn't one yet, so a stuck negative-balance situation currently has no escape hatch except logging a receipt.
- **Periodic targets** (`targets` table, `src/modules/targets/targets.routes.ts`) are deliberately generic in shape — a `metric` column, even though only `"new_customers"` is validated today — so a `"visits"` or `"sales_revenue"` target can be added later by widening an enum, not adding a table. A target can be set globally (`rep_id = NULL`) or overridden per rep; `GET /dashboard/rep-targets?periodType=day|week|month|quarter` resolves the effective target per rep (their override, else the global default, else `null` meaning "no target set" — never silently treated as zero) and compares it against actual new customers so far in the current period, computed "period to date" (e.g. 1st of the month through today, not the whole month) via `resolvePeriodBounds()` in `src/common/period.ts`.
- **Visit activities and products discussed are stored as JSON on `visit_logs`**, not a child table — same reasoning as `stock_daily.product_quantities`: this data is always read and written as a whole alongside its parent visit, never filtered or joined on independently, so a JSON column is simpler than a join for no real cost. `VISIT_ACTIVITY_TYPES` in `visit-logs.routes.ts` is the source of truth for valid activity values; the frontend keeps its own matching copy (with display labels) in `types/visits.ts` — there's no shared schema file between the two, so keep them in sync by hand if you add a value.
- **Completing a plan now requires actually logging a visit, not just flipping a status.** `PATCH /visit-plans/:id/status` still exists for marking a plan `missed` (nothing happened, nothing to log), but the old shortcut of marking a plan `completed` with zero visit detail is gone from the UI — completion now only happens as a side effect of `POST /visit-logs` with that plan's id attached. `POST /visit-logs` also now checks that a rep can only log a visit against their own plan (this wasn't checked before — a rep could technically pass any planId and silently complete someone else's plan).
- **New customers are attributed to a rep via their territory, not directly** — `customers` has no `created_by` column, only `territory_id`. `GET /dashboard/rep-targets` counts new customers in a rep's *territory* and treats that as "this rep's new customers," which is correct under this app's one-rep-per-territory model but would double-count if a territory ever gets a second rep. Adding a `created_by_rep_id` column to `customers` would fix this properly if that scenario becomes real; not needed for the current model.
- **The dashboard's date range now drives two more numbers**: `newCustomersInPeriod` (customers whose `created_at` falls in the requested window, not just the running total) and `revenue.salesCount` (how many sales, not just their total value) — both scoped by territory exactly like everything else on that endpoint.
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
- An admin-only "correcting entry" endpoint for stock balances (see the note above on `adjustStockBalance` — right now the only way to increase a rep's balance is a genuine receipt).
- `DELETE /targets/:id` exists on the backend (removes an override, reverting a rep to the default target) but has no frontend button wired to it yet — see the web README.
- A `created_by_rep_id` column on `customers`, if per-rep (rather than per-territory) new-customer attribution ever needs to be exact under a multi-rep-per-territory setup.
- Wiring this up to the Flutter mobile app (not included in this scaffold yet).

All seven rep-owned-data list endpoints (customers, visit-plans, visit-logs, sales, expenses, incentives, stock receipts/balances), the dashboard aggregate, the ledger/debt views, the report exports, and — as of this round — the territories list itself now share the same territory/region RBAC scoping. This closes what turned out to be the last remaining unscoped list endpoint in the backend.

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
