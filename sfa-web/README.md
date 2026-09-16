# SFA Platform — Web App

React + TypeScript + Tailwind CSS frontend for managers (RSM/NSM/Admin) and, optionally, reps. Talks to the backend API scaffold via `VITE_API_URL`.

## What's built in this pass

- **Design system**: a bordered/hairline-rule visual language ("Territory Ledger") instead of a shadowed SaaS-card look — see the token list below. Shared primitives live in `src/components/ui/`.
- **Auth**: login page, JWT stored in `localStorage`, `AuthContext` restoring the session via `GET /auth/me` on load, a `ProtectedRoute` wrapper.
- **App shell**: navy sidebar navigation, filtered by role (e.g. "Users & Territories" only shows for admins).
- **Dashboard Overview** (`/`) — the default landing screen: KPI strip (revenue, active customers, visits, debt, expenses) with sentence-case status verdicts, a revenue-by-product bar panel, a top-customers table, a debt/credit-risk panel, and an expenses-vs-limit panel. Filterable by territory (managers only) and date range.
- **Debt & Ledger** (`/debt-ledger`) — the fuller version of the risk table: every customer with a balance, searchable, with summary counts by risk band.
- **Planning** (`/planning`) — daily call plans. Reps can add a plan (customer, date, product to detail, objective) and mark it done/missed; managers get a read-only view across their reps, filterable by rep (via the new `/users/directory` endpoint — see backend note below) and status.
- **Customers** (`/customers`) — the territory customer database: searchable, filterable by status and (for managers) territory, paginated, with an inline add/edit form. Reps can only add customers into their own territory; the territory field is locked for them.
- Every other nav item (Sales, Expenses, Incentives, Reports, Users & Territories) renders a `ComingSoon` placeholder so the navigation is fully wired even though only these four screens are built out so far.

## Backend changes made alongside these screens

Building the Planning screen surfaced a real RBAC gap and a missing endpoint, both fixed in the backend scaffold (re-download `sfa-backend.zip` if you have an older copy):

- **Fixed**: `GET /visit-plans` previously showed *all* reps' plans to any manager who didn't pass `?repId=`, regardless of territory/region. It now applies the same territory/region scoping as the customers module.
- **Added**: `GET /users/directory` — a lightweight, name-only list of reps visible to the current manager (RSM/NSM/admin), used to populate the "filter by rep" dropdown without exposing the full admin user-management endpoints to non-admins.
- **Added**: `GET /customers` now accepts an optional `?territoryId=` query param (applied after role-scoping, so a manager can never use it to see outside their allowed territories).

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
- **Customers**: no delete/deactivate action in the UI yet, though the backend's soft-delete pattern would support one easily (a status toggle button next to "Edit" is the natural next step).
- No CSV/PDF export buttons yet (backend doesn't expose the export endpoints yet either).
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
    ComingSoon.tsx
    Planning.tsx                Daily call plans (rep create/update, manager read-only)
    Customers.tsx                Customer database: search, filter, paginate, add/edit
    dashboard/DashboardOverview.tsx   Main KPI screen
    dashboard/DebtLedger.tsx          Full debt/credit-risk table
  components/
    CustomerForm.tsx             Shared add/edit form used by Customers.tsx
    ui/Pagination.tsx, StatusTag.tsx, Form.tsx (Field/Input/Select/TextArea)
  types/dashboard.ts          Mirrors the backend's response shapes
  App.tsx                     Routing
  main.tsx                    Entry point
```
