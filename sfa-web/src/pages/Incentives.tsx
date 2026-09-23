import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Incentive } from "../types/incentives";
import { RepSummary } from "../types/planning";
import { Panel } from "../components/ui/Panel";
import { StatusTag } from "../components/ui/StatusTag";
import { Field, Input } from "../components/ui/Form";

function nairaFull(amount: number): string {
  return `₦${Number(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function periodLabel(period: string): string {
  return new Date(period).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

export function Incentives() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";
  const canRecalculate = user && (user.role === "admin" || user.role === "nsm");

  const [period, setPeriod] = useState(currentPeriod());
  const [reps, setReps] = useState<RepSummary[]>([]);
  const [repId, setRepId] = useState<number | undefined>(undefined);

  const [rows, setRows] = useState<Incentive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recalcMonth, setRecalcMonth] = useState(currentPeriod().slice(0, 7));
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<RepSummary[]>("/users/directory").then(setReps).catch(() => {});
  }, [isManager]);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<Incentive[]>("/incentives", { query: { period, repId } })
      .then(setRows)
      .catch(() => setError("Could not load incentives. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [period, repId]);

  const summary = useMemo(() => {
    const qualifying = rows.filter((r) => r.status === "qualified" || r.status === "paid");
    const totalRep = rows.reduce((sum, r) => sum + Number(r.amount_rep), 0);
    const totalManager = rows.reduce((sum, r) => sum + Number(r.amount_rsm) + Number(r.amount_nsm), 0);
    return { qualifyingCount: qualifying.length, totalRep, totalManager };
  }, [rows]);

  async function handleRecalculate(e: FormEvent) {
    e.preventDefault();
    setRecalculating(true);
    setRecalcError(null);
    setRecalcMessage(null);
    try {
      const res = await apiRequest<{ period: string; recalculated: number }>("/incentives/recalculate", {
        method: "POST",
        body: { period: `${recalcMonth}-01` },
      });
      setRecalcMessage(`Recalculated ${res.recalculated} rep${res.recalculated === 1 ? "" : "s"} for ${periodLabel(res.period)}.`);
      setPeriod(res.period);
      load();
    } catch (err) {
      setRecalcError(err instanceof Error ? err.message : "Could not recalculate incentives.");
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Incentives</h1>
          <p className="text-[13.5px] text-ink-soft">
            {isManager ? "Commission qualification and payouts across your reps" : "Your commission summary"}
          </p>
        </div>
      </div>

      {canRecalculate && (
        <div className="mb-5">
          <Panel title="Recalculate a period" subtitle="Recomputes qualification and payout from actual sales revenue">
            <form onSubmit={handleRecalculate} className="flex items-end gap-4">
              <Field label="Month">
                <Input
                  type="month"
                  required
                  value={recalcMonth}
                  onChange={(e) => setRecalcMonth(e.target.value)}
                />
              </Field>
              <button
                type="submit"
                disabled={recalculating}
                className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
              >
                {recalculating ? "Recalculating…" : "Recalculate"}
              </button>
              <div>
                {recalcError && <p className="text-[12.5px] text-poor">{recalcError}</p>}
                {recalcMessage && <p className="text-[12.5px] text-good">{recalcMessage}</p>}
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className="flex bg-panel border border-border rounded mb-6">
        <div className="flex-1 px-5 py-4 border-r border-border">
          <p className="text-xs text-ink-soft mb-1.5">Period</p>
          <p className="font-serif text-2xl text-ink">{periodLabel(period)}</p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border">
          <p className="text-xs text-ink-soft mb-1.5">Qualifying reps</p>
          <p className="font-serif text-2xl text-good">{summary.qualifyingCount}</p>
        </div>
        <div className="flex-1 px-5 py-4 border-r border-border">
          <p className="text-xs text-ink-soft mb-1.5">Rep payouts</p>
          <p className="font-serif text-2xl text-ink">{nairaFull(summary.totalRep)}</p>
        </div>
        {isManager && (
          <div className="flex-1 px-5 py-4">
            <p className="text-xs text-ink-soft mb-1.5">Manager payouts</p>
            <p className="font-serif text-2xl text-ink">{nairaFull(summary.totalManager)}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2.5 mb-4">
        <Input
          type="month"
          value={period.slice(0, 7)}
          onChange={(e) => setPeriod(`${e.target.value}-01`)}
          className="w-40"
        />
        {isManager && (
          <select
            className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px]"
            value={repId ?? ""}
            onChange={(e) => setRepId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All reps</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <Panel title="Incentive detail" subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">
            No incentive data for this period yet
            {canRecalculate ? " — try recalculating above once sales have been recorded." : "."}
          </p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                {isManager && <th className="pb-2">Rep</th>}
                <th className="pb-2 text-right">Revenue</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Rep payout</th>
                {isManager && <th className="pb-2 text-right">RSM payout</th>}
                {isManager && <th className="pb-2 text-right">NSM payout</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#EDEEE4] last:border-b-0">
                  {isManager && <td className="py-2.5">{r.rep_name}</td>}
                  <td className="py-2.5 text-right tabular-nums">{nairaFull(r.metric_value)}</td>
                  <td className="py-2.5">
                    <StatusTag status={r.status} />
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium">{nairaFull(r.amount_rep)}</td>
                  {isManager && <td className="py-2.5 text-right tabular-nums">{nairaFull(r.amount_rsm)}</td>}
                  {isManager && <td className="py-2.5 text-right tabular-nums">{nairaFull(r.amount_nsm)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
