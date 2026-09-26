# SFA Platform — Web App

React + TypeScript + Tailwind CSS frontend for managers (RSM/NSM/Admin) and, optionally, reps. Talks to the backend API scaffold via `VITE_API_URL`.

## What's built in this pass

- **Design system**: a bordered/hairline-rule visual language ("Territory Ledger") instead of a shadowed SaaS-card look — see the token list below. Shared primitives live in `src/components/ui/`.
- **Auth**: login page, JWT stored in `localStorage`, `AuthContext` restoring the session via `GET /auth/me` on load, a `ProtectedRoute` wrapper.
- **App shell**: navy sidebar navigation, filtered by role (e.g. "Master Data" only shows for admins).
- **Dashboard Overview** (`/`) — the default landing screen: KPI strip (revenue, sales made, active customers, new customers this period, visits, debt, expenses) with sentence-case status verdicts, a **"New customers vs. target" panel** (day/week/month/quarter tabs, each rep's actual new-customer count against their target, with inline target editing for admin/NSM), a revenue-by-product bar panel, a top-customers table, a debt/credit-risk panel, and an expenses-vs-limit panel. Filterable by territory (managers only) and date range — including a genuine **custom range** (two date pickers), not just the three presets, so a manager can pull numbers for an arbitrary window rather than only "this month/last month/last 7 days."
- **Debt & Ledger** (`/debt-ledger`) — the fuller version of the risk table: every customer with a balance, searchable, with summary counts by risk band.
- **Planning** (`/planning`) — daily call plans. Reps can add a plan (customer, date, product to detail, objective) and mark it missed; managers get a read-only view across their reps, filterable by rep (via the new `/users/directory` endpoint — see backend note below) and status. **Changed this round**: there's no more instant "mark done" shortcut — completing a plan now means clicking "Log visit," which takes you to the Visits screen below with that plan and customer pre-filled.
- **Visits** (`/visits`) — new screen. Reps log a visit: optionally link it to an open plan (auto-fills the customer), pick the date, check off which activities were carried out (product detailing, sample distribution, order placed, payment collection, merchandising, complaint handling, training/education, relationship building, or other), optionally check off which products were discussed, and add free-text notes. Managers get a read-only, rep-filterable history. Logging a visit against a plan marks that plan completed automatically — there's no separate action for it anymore.
- **Customers** (`/customers`) — the territory customer database: searchable, filterable by status and (for managers) territory, paginated. **Only reps can add a new customer** — the "+ New customer" button and create form are hidden entirely for RSM/NSM/admin, matching a backend restriction (see below), not just a UI convention. Managers retain the ability to edit an existing customer within their scope.
- **Sales & Redistribution** (`/sales`) — reps record a sale (customer, product, quantity, payment status) and see their own history; managers get a read-only, rep-filterable view scoped to their territory/region. The form shows an estimated revenue live as you pick a product and quantity, and confirms the recorded revenue/amount-paid after submit. If a sale would exceed the rep's on-hand stock for that product, the backend rejects it and the form surfaces that error message directly — nothing silently oversells.
- **Stock** (`/stock`) — new screen. Reps log stock received from the office (product, quantity, date) and see their current on-hand balance per product, plus a receipt history; managers get the same views read-only across their reps, filterable by rep. Recording a sale on the Sales screen automatically depletes the matching balance shown here — the two screens are reading the same underlying numbers, not two independent trackers.
- **Expenses** (`/expenses`) — reps log fuel/service/other costs and immediately see their month-to-date total and whether they've crossed the monthly limit; RSM/admin get an approval queue (defaults to "pending") with Approve/Reject actions, filterable by rep and status.
- **Incentives** (`/incentives`) — reps see their own commission summary for a period; RSM/NSM/admin see it across their reps with rep/RSM/NSM payout columns; admin/NSM additionally get a "Recalculate" action that recomputes qualification and payout from actual sales revenue for a chosen month.
- **Reports** (`/reports`, RSM/NSM/admin only) — four CSV downloads (customers, sales, expenses, debt-analysis), each scoped to the viewer's territory/region on the backend, with a territory-narrowing dropdown and date-range/status filters where relevant. Downloads go through a new `apiDownload()` helper in `api/client.ts` (a plain link can't carry the auth header, so this fetches as a blob and triggers the save client-side).
- **Master Data** (`/admin/users`, admin only) — renamed from "Users & Territories": territory list, a **Products catalog** (name, category, SKU, unit price — add/edit inline; this was in the original design spec but had never actually been built until now), and a paginated user directory with add/edit/deactivate. Creating a user sets a temporary password; editing does not (there's no password-reset flow yet — see the backend README).
- Every nav item now routes to a real screen — `ComingSoon.tsx` is unused dead code at this point, left in place in case a future screen needs a placeholder again.

## Backend changes made alongside these screens

Building Reports surfaced something more consequential than the previous per-module RBAC gaps: the **Dashboard Overview screen you're already using** had two real issues under the hood — `GET /dashboard/overview` computed expense and debt totals with *no* territory scoping at all (regardless of role), and accepted any `?territoryId=` a manager passed without checking it was in their allowed scope. Both are fixed now, along with the equivalent check in `GET /ledger/debt-analysis` and `GET /ledger/customers/:id`. None of the frontend changed for this — the same Overview and Debt & Ledger screens now just return correctly-scoped numbers. Worth knowing about even though there's no UI diff to point at.

**Previous round** — customer creation and sale recording are now backend-enforced as rep-only (`requireRole("rep")`), not just a UI convention; a manager hitting the API directly gets a 403, same as the Customers screen hiding the button. Stock is a new concept end to end: `stock_receipts` (an intake log) and `stock_balances` (a running per-rep, per-product on-hand quantity) are new tables, and recording a sale now depletes the matching balance in the same DB transaction as the ledger/stock_daily updates — if the rep doesn't have enough on hand, the whole sale is rejected, not just flagged. The dashboard also gained `newCustomersInPeriod` and `revenue.salesCount`, and the Overview screen's date filter gained a genuine custom range instead of only fixed presets.

**This round** — a new `targets` table and admin/NSM-only `targets` module let you set a "new customers" target per period type (day/week/month/quarter), either as a global default or a per-rep override. The Overview screen's new "New customers vs. target" panel shows each rep's actual count for the current period against their effective target (their override, or the default, or "no target set" if neither exists — never a silent zero), with tabs to switch period type and inline editing for admin/NSM. Worth reading the backend README's note on this: new customers are attributed to a rep *via their territory*, not directly (there's no `created_by` column on `customers`), which is correct under the current one-rep-per-territory model but wouldn't be exact if a territory ever had two reps.

## Design tokens ("Territory Ledger")

| Token | Value | Use |
|---|---|---|
| `ink` | `#1B2A4A` | Sidebar, headings, primary text |
| `paper` | `#EEF0EA` | Page background |
| `panel` | `#FFFFFF` | Panel/card background |
| `border` | `#D9DAC9` | Hairline borders — used instead of drop shadows |
| `accent` | `#C1852B` | Bar charts, active nav indicator |
| `good` / `watch` / `poor` | `#2F6F62` / `#B5651D` / `#9E3B33` | Status verdicts and risk tags |

Fonts: **Source Serif 4** for headings and KPI numbers, **IBM Plex Sans** for body/UI/tables (loaded from Google Fonts in `index.html`).

A static HTML mock of the Overview screen was built and screenshotted for visual review before this was ported into React — see the design rationale in the parent conversation if you have it, or just treat the tokens above as the source of truth.

## Setup

```bash
cp .env.example .env
# point VITE_API_URL at your running backend, e.g. http://localhost:4000/api/v1

npm install
npm run dev
```

Opens on `http://localhost:5173`. Log in with one of the seeded backend accounts (see the backend README), e.g. `admin@example.com` / `ChangeMe123!`.

## Known simplifications (next steps)

- The **Expenses vs. limit** panel on the Overview page shows one territory-wide bar rather than one bar per rep (as sketched in the original design mock), because the backend doesn't yet expose a per-rep expense summary endpoint. Add `GET /expenses/summary?groupBy=rep` on the backend, then swap this panel to loop over reps.
- **Planning**: managers can only filter by rep or status, not by date range yet (the backend supports `?from=`/`?to=`, the UI just doesn't expose it yet — small addition).
- **Visits**: activity types and their display labels are duplicated between `types/visits.ts` (frontend) and `VISIT_ACTIVITY_TYPES` (backend) with no shared source — adding a new activity type means editing both files by hand and keeping them in sync. The "products discussed" checkbox list has no search/filter, which will get unwieldy once the product catalog grows past a couple dozen items.
- **Customers**: no delete/deactivate action in the UI yet, though the backend's soft-delete pattern would support one easily (a status toggle button next to "Edit" is the natural next step). Only reps can create a customer now — if a manager legitimately needs to onboard one directly (a one-off, unusual case), there's currently no path for that short of asking a rep to do it. **Fixed a couple rounds ago**: the Territory field on a rep's own create form used to render as a blank, disabled text box instead of showing their territory name, because territories were only ever fetched for managers — reps never had the data to display. It's now a disabled single-option dropdown showing the rep's actual territory, and territories are fetched for every role. **Fixed this round, at the API level**: that UI fix alone didn't stop a rep from calling `GET /territories` directly and getting back every territory in the organisation — the endpoint itself had no scoping. It's now scoped the same as everything else (see the backend README), so the dropdown showing only one option and the API actually only returning one option are now the same thing, not a UI convention sitting on top of an open endpoint. This also means an RSM's territory-filter dropdowns on Reports, the Dashboard, and Debt & Ledger now correctly show only their own region instead of every territory company-wide.
- **Sales**: the `visitId` field on a sale (linking it to a logged visit) is never set from this UI — sales are recorded standalone. Once the Visits screen exists, wire the two together.
- **Stock**: no way to correct a balance without a real receipt — if a rep's on-hand count ever needs a manual adjustment (a data-entry error, damaged goods, a return), there's no admin-side "correcting entry" endpoint yet. See the backend README's note on `adjustStockBalance` for the same gap from the API side.
- **Targets**: no "reset to default" button — the backend's `DELETE /targets/:id` exists to remove a per-rep override, but the panel only ever upserts (set default, set a rep's override); if you set an override you no longer want, the current workaround is manually setting it back to match the default value, not actually removing the override row. Also, only "new customers" is implemented as a target metric — the schema and API are shaped to add "visits" or "sales revenue" targets later without a new table, but no UI exists for anything beyond new-customer targets yet.
- **Expenses**: the `MONTHLY_EXPENSE_LIMIT` constant is duplicated in both the backend (`expenses.routes.ts`) and this page — move both to a shared `/settings` endpoint once one exists, rather than keeping two hardcoded numbers in sync by hand.
- **Incentives**: the recalculate action always targets rep-level revenue with no per-product breakdown, even though the schema supports a `product_id` per incentive row — `product_id`/`product_name` will stay `null` until the recalculation logic is extended to compute per-product qualification. The qualifying-revenue threshold and payout amounts are hardcoded in the backend (`INCENTIVE_RULES` in `incentives.routes.ts`) — same "move to a settings table" note as the expense limit.
- **Reports**: CSV only, no PDF (the backend doesn't generate PDF exports yet).
- **Master Data**: no password-reset flow — editing a user's password isn't possible from the UI or the API yet (`PATCH /users/:id` deliberately excludes it). A user who forgets their password currently needs a new temporary one set directly in the database until `/auth/forgot-password` exists. The Products panel has no delete action (matching Customers/Territories — soft-delete exists on the backend, no UI button yet), and no pagination (fetched with `pageSize: 100`, which will silently stop showing everything if the catalog ever exceeds 100 products).
- No refresh-token rotation on 401 — a request with an expired access token currently just fails; wire up a call to `POST /auth/refresh` in `api/client.ts` before shipping.
- No automated tests yet (Vitest + React Testing Library would be the natural next addition).

## Project structure

```
src/
  api/client.ts               Typed fetch wrapper (attaches JWT, builds query strings)
  context/AuthContext.tsx     Login/logout/session state
  components/
    layout/AppShell.tsx       Sidebar + main content frame
    ui/Panel.tsx, KpiCard.tsx, Bars.tsx   Design-system primitives
    ProtectedRoute.tsx
  pages/
    Login.tsx
    ComingSoon.tsx               Now unused — every nav item routes to a real screen
    Planning.tsx                Daily call plans (rep create/update, manager read-only)
    Visits.tsx                  Log a visit: activities carried out, products discussed, notes; completes a linked plan
    Customers.tsx                Customer database: search, filter, paginate, add/edit
    Sales.tsx                    Sales & Redistribution: rep recording form, manager read-only history
    Stock.tsx                    Stock receipts (rep) and on-hand balances (rep + manager read-only)
    Expenses.tsx                 Expense logging (rep) and approval queue (RSM/admin)
    Incentives.tsx                Commission summary (rep) and payout review + recalculate (manager)
    Reports.tsx                  CSV export downloads (RSM/NSM/admin)
    UsersTerritories.tsx          "Master Data" admin screen: territories + products + user directory CRUD
    dashboard/DashboardOverview.tsx   Main KPI screen
    dashboard/DebtLedger.tsx          Full debt/credit-risk table
  components/
    CustomerForm.tsx             Shared add/edit form used by Customers.tsx
    dashboard/RepTargetsPanel.tsx   New customers vs. target, period-type tabs, admin/NSM target editing
    ui/Pagination.tsx, StatusTag.tsx, Form.tsx (Field/Input/Select/TextArea)
  types/dashboard.ts, users.ts, incentives.ts, sales.ts, expenses.ts, planning.ts, customers.ts, stock.ts, targets.ts, visits.ts
  App.tsx                     Routing
  main.tsx                    Entry point
```
