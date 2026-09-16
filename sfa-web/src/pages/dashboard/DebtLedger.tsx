import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DebtRow, Territory } from "../../types/dashboard";
import { Panel } from "../../components/ui/Panel";
import { RiskTag } from "../../components/ui/KpiCard";

function nairaFull(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function DebtLedger() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState<number | undefined>(user?.territory_id ?? undefined);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<Territory[]>("/territories").then(setTerritories).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiRequest<DebtRow[]>("/ledger/debt-analysis", { query: { territoryId } })
      .then(setRows)
      .catch(() => setError("Could not load debt analysis. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [territoryId]);

  const filteredRows = useMemo(
    () => rows.filter((r) => r.businessName.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const summary = useMemo(() => {
    const total = filteredRows.reduce((sum, r) => sum + r.balance, 0);
    const poor = filteredRows.filter((r) => r.riskLevel === "poor").length;
    const watch = filteredRows.filter((r) => r.riskLevel === "watch").length;
    return { total, poor, watch };
  }, [filteredRows]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Debt & credit risk</h1>
          <p className="text-[13.5px] text-ink-soft">
            Every customer with an outstanding balance, ranked worst first
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
          <input
            type="text"
            placeholder="Search business name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px] w-56"
          />
        </div>
      </div>

      <div className="flex bg-panel border border-border rounded mb-6">
        <div className="flex-1 px-5 py-4 border-r border-border">
          <p className="text-xs text-ink-soft mb-1.5">Total outstanding</p>
          <p className="font-serif text-2xl text-ink">{nairaFull(summary.total)}</p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border">
          <p className="text-xs text-ink-soft mb-1.5">Customers in watch band</p>
          <p className="font-serif text-2xl text-watch">{summary.watch}</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <p className="text-xs text-ink-soft mb-1.5">Customers at high risk</p>
          <p className="font-serif text-2xl text-poor">{summary.poor}</p>
        </div>
      </div>

      <Panel title="Customer balances" subtitle={`${filteredRows.length} customer${filteredRows.length === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">No outstanding balances match this view.</p>
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
              {filteredRows.map((row) => (
                <tr key={row.customerId} className="border-b border-[#EDEEE4] last:border-b-0">
                  <td className="py-2.5">{row.businessName}</td>
                  <td className="py-2.5 text-right tabular-nums">{nairaFull(row.balance)}</td>
                  <td className="py-2.5 text-right">
                    <RiskTag level={row.riskLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
