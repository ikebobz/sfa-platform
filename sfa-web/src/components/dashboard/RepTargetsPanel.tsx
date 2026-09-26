import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { PeriodType, RepTargetsResponse } from "../../types/targets";
import { Panel } from "../ui/Panel";
import { RiskTag } from "../ui/KpiCard";

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  quarter: "This quarter",
};

function formatPeriodRange(start: string, end: string): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function RepTargetsPanel({ territoryId }: { territoryId?: number }) {
  const { user } = useAuth();
  const canEditTargets = user && (user.role === "admin" || user.role === "nsm");

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [data, setData] = useState<RepTargetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [defaultInput, setDefaultInput] = useState("");
  const [savingDefault, setSavingDefault] = useState(false);
  const [repInputs, setRepInputs] = useState<Record<number, string>>({});
  const [savingRepId, setSavingRepId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<RepTargetsResponse>("/dashboard/rep-targets", { query: { periodType, territoryId } })
      .then((res) => {
        setData(res);
        setDefaultInput(res.defaultTarget !== null ? String(res.defaultTarget) : "");
        setRepInputs(Object.fromEntries(res.rows.map((r) => [r.repId, r.target !== null ? String(r.target) : ""])));
      })
      .catch(() => setError("Could not load rep targets. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [periodType, territoryId]);

  async function saveDefault() {
    const value = Number(defaultInput);
    if (!defaultInput || Number.isNaN(value) || value < 0) return;
    setSavingDefault(true);
    setSaveError(null);
    try {
      await apiRequest("/targets", { method: "PUT", body: { periodType, targetValue: value } });
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the default target.");
    } finally {
      setSavingDefault(false);
    }
  }

  async function saveRepTarget(repId: number) {
    const raw = repInputs[repId];
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value < 0) return;
    setSavingRepId(repId);
    setSaveError(null);
    try {
      await apiRequest("/targets", { method: "PUT", body: { periodType, targetValue: value, repId } });
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save this rep's target.");
    } finally {
      setSavingRepId(null);
    }
  }

  return (
    <Panel
      title="New customers vs. target"
      subtitle={data ? `${PERIOD_LABELS[periodType]} · ${formatPeriodRange(data.periodStart, data.periodEnd)}` : undefined}
      action={
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((pt) => (
            <button
              key={pt}
              onClick={() => setPeriodType(pt)}
              className={`text-[11.5px] px-2.5 py-1 rounded ${
                periodType === pt ? "bg-ink text-white" : "text-ink-soft hover:bg-track"
              }`}
            >
              {pt.charAt(0).toUpperCase() + pt.slice(1)}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <p className="text-[12.5px] text-ink-soft">Loading…</p>
      ) : error || !data ? (
        <p className="text-[12.5px] text-poor">{error ?? "No data available."}</p>
      ) : (
        <>
          {canEditTargets && (
            <div className="flex items-end gap-2.5 mb-4 pb-4 border-b border-border">
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">
                  Default target ({PERIOD_LABELS[periodType].toLowerCase()}, applies to reps without their own override)
                </label>
                <input
                  type="number"
                  min={0}
                  value={defaultInput}
                  onChange={(e) => setDefaultInput(e.target.value)}
                  className="w-28 border border-border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={saveDefault}
                disabled={savingDefault}
                className="bg-ink text-white text-sm px-3 py-1.5 rounded hover:bg-ink/90 disabled:opacity-60"
              >
                {savingDefault ? "Saving…" : "Save default"}
              </button>
              {saveError && <p className="text-[12.5px] text-poor">{saveError}</p>}
            </div>
          )}

          {data.rows.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">No reps in this view.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Rep</th>
                  <th className="pb-2 text-right">New customers</th>
                  <th className="pb-2 text-right">Target</th>
                  <th className="pb-2 text-right">Attainment</th>
                  <th className="pb-2">Status</th>
                  {canEditTargets && <th className="pb-2"></th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.repId} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2.5">{row.repName}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{row.actual}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {canEditTargets ? (
                        <input
                          type="number"
                          min={0}
                          value={repInputs[row.repId] ?? ""}
                          onChange={(e) => setRepInputs((v) => ({ ...v, [row.repId]: e.target.value }))}
                          placeholder="—"
                          className="w-16 border border-border rounded px-2 py-1 text-right text-[12.5px]"
                        />
                      ) : row.target === null ? (
                        <span className="text-ink-soft">—</span>
                      ) : (
                        row.target
                      )}
                      {row.isOverride && <span className="ml-1 text-[10.5px] text-accent">override</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.attainmentPct === null ? <span className="text-ink-soft">—</span> : `${row.attainmentPct}%`}
                    </td>
                    <td className="py-2.5">
                      {row.status === "no_target" ? (
                        <span className="text-[11px] text-ink-soft">No target set</span>
                      ) : (
                        <RiskTag level={row.status} />
                      )}
                    </td>
                    {canEditTargets && (
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => saveRepTarget(row.repId)}
                          disabled={savingRepId === row.repId}
                          className="text-accent hover:underline disabled:opacity-60"
                        >
                          {savingRepId === row.repId ? "Saving…" : "Save"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Panel>
  );
}
