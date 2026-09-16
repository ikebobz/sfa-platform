import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DashboardOverview as OverviewData, DebtRow, Territory } from "../../types/dashboard";
import { Panel } from "../../components/ui/Panel";
import { KpiCard, RiskTag } from "../../components/ui/KpiCard";
import { BarRow, ProgressBar } from "../../components/ui/Bars";

function naira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(2)}m`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(1)}k`;
  return `₦${amount.toFixed(0)}`;
}

function nairaFull(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

// Mirrors the backend's expenses.routes.ts MONTHLY_EXPENSE_LIMIT — move both to a
// shared config source once a /settings endpoint exists.
const MONTHLY_EXPENSE_LIMIT = 100_000;

type DateRangePreset = "this_month" | "last_7_days" | "last_month";

function resolveDateRange(preset: DateRangePreset): { from: string; to: string; label: string } {
  const now = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  if (preset === "last_7_days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: toISO(from), to: toISO(now), label: "Last 7 days" };
  }
  if (preset === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toISO(from), to: toISO(to), label: "Last month" };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISO(from), to: toISO(now), label: "This month" };
}

export function DashboardOverview() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState<number | undefined>(user?.territory_id ?? undefined);
  const [preset, setPreset] = useState<DateRangePreset>("this_month");
  const [data, setData] = useState<OverviewData | null>(null);
  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => resolveDateRange(preset), [preset]);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<Territory[]>("/territories").then(setTerritories).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<OverviewData>("/dashboard/overview", {
        query: { territoryId, from: range.from, to: range.to },
      }),
      apiRequest<DebtRow[]>("/ledger/debt-analysis", { query: { territoryId } }),
    ])
      .then(([overview, debt]) => {
        setData(overview);
        setDebtRows(debt.slice(0, 5));
      })
      .catch(() => setError("Could not load the dashboard. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [territoryId, range.from, range.to]);

  const selectedTerritoryLabel =
    territories.find((t) => t.id === territoryId)?.name ?? (isManager ? "All territories" : "My territory");

  if (loading) {
    return <p className="text-sm text-ink-soft">Loading territory data…</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-poor">{error ?? "No data available."}</p>;
  }

  const maxProductRevenue = Math.max(1, ...data.revenue.topProducts.map((p) => p.revenue));
  const expensePct = Math.min(100, (data.expenses.total / MONTHLY_EXPENSE_LIMIT) * 100);
  const expenseOverLimit = data.expenses.total > MONTHLY_EXPENSE_LIMIT;

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Territory overview</h1>
          <p className="text-[13.5px] text-ink-soft">
            {selectedTerritoryLabel} · {range.label}
          </p>
        </div>
        <div className="flex gap-2.5">
          {isManager && (
            <select
              className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px]"
              value={territoryId ?? ""}
              onChange={(e) => setTerritoryId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All territories</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px]"
            value={preset}
            onChange={(e) => setPreset(e.target.value as DateRangePreset)}
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_7_days">Last 7 days</option>
          </select>
        </div>
      </div>

      <div className="flex bg-panel border border-border rounded mb-6">
        <KpiCard label="Revenue" value={naira(data.revenue.total)} />
        <KpiCard
          label="Active customers"
          value={`${data.database.activeCustomers} / ${data.database.totalCustomers}`}
          verdict={data.database.verdict.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
          tone={data.database.activeRatio >= 0.7 ? "good" : "watch"}
        />
        <KpiCard label="Visits logged" value={String(data.visits.totalVisits)} />
        <KpiCard
          label="Outstanding debt"
          value={naira(data.debt.total)}
          verdict={debtRows.some((r) => r.riskLevel === "poor") ? "Some customers at high risk" : undefined}
          tone={debtRows.some((r) => r.riskLevel === "poor") ? "poor" : "good"}
        />
        <KpiCard
          label="Expenses"
          value={naira(data.expenses.total)}
          verdict={expenseOverLimit ? `Above ${naira(MONTHLY_EXPENSE_LIMIT)} monthly limit` : "Within monthly limit"}
          tone={expenseOverLimit ? "poor" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5 mb-5">
        <Panel title="Revenue by product" subtitle="Share of territory revenue, current period">
          {data.revenue.topProducts.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">No sales recorded in this period yet.</p>
          ) : (
            data.revenue.topProducts.map((p) => (
              <BarRow
                key={p.id}
                label={p.name}
                value={p.revenue}
                displayValue={naira(p.revenue)}
                maxValue={maxProductRevenue}
              />
            ))
          )}
        </Panel>

        <Panel title="Top customers" subtitle="By revenue, current period">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                <th className="pb-2 w-6"></th>
                <th className="pb-2">Business</th>
                <th className="pb-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.revenue.topCustomers.slice(0, 5).map((c, i) => (
                <tr key={c.id} className="border-b border-[#EDEEE4] last:border-b-0">
                  <td className="py-2 text-ink-soft">{i + 1}</td>
                  <td className="py-2">{c.business_name}</td>
                  <td className="py-2 text-right tabular-nums">{nairaFull(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
        <Panel title="Debt & credit risk" subtitle="Customers with an outstanding balance, worst first">
          {debtRows.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">No outstanding customer balances.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Business</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2 text-right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {debtRows.map((row) => (
                  <tr key={row.customerId} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2">{row.businessName}</td>
                    <td className="py-2 text-right tabular-nums">{nairaFull(row.balance)}</td>
                    <td className="py-2 text-right">
                      <RiskTag level={row.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Expenses vs. limit" subtitle="Territory total, current period">
          {/* Simplified to a single territory-wide bar for this scaffold. Once a
              /expenses/summary?groupBy=rep endpoint exists, replace this with one
              ProgressBar per rep, as sketched in the design mock. */}
          <ProgressBar
            label={selectedTerritoryLabel}
            currentDisplay={nairaFull(data.expenses.total)}
            limitDisplay={nairaFull(MONTHLY_EXPENSE_LIMIT)}
            pct={expensePct}
            overLimit={expenseOverLimit}
          />
        </Panel>
      </div>
    </div>
  );
}
