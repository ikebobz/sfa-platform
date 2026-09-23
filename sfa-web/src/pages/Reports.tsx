import { FormEvent, useEffect, useState } from "react";
import { apiRequest, apiDownload } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Territory } from "../types/dashboard";
import { Panel } from "../components/ui/Panel";
import { Field, Input, Select } from "../components/ui/Form";

interface ReportDef {
  key: string;
  title: string;
  description: string;
  path: string;
  filename: string;
  hasDateRange: boolean;
  hasStatus?: { label: string; options: { value: string; label: string }[] };
}

const REPORTS: ReportDef[] = [
  {
    key: "customers",
    title: "Customer database",
    description: "Every customer in scope, with location, status, and last visit/supply dates.",
    path: "/reports/customers/export",
    filename: "customers-report.csv",
    hasDateRange: false,
    hasStatus: {
      label: "Status",
      options: [
        { value: "", label: "All statuses" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  },
  {
    key: "sales",
    title: "Sales & redistribution",
    description: "Every sale in scope: rep, customer, product, quantity, revenue, and payment status.",
    path: "/reports/sales/export",
    filename: "sales-report.csv",
    hasDateRange: true,
  },
  {
    key: "expenses",
    title: "Expenses",
    description: "Every logged expense in scope, with fuel/service/other cost breakdown and approval status.",
    path: "/reports/expenses/export",
    filename: "expenses-report.csv",
    hasDateRange: true,
  },
  {
    key: "debt-analysis",
    title: "Debt & credit risk",
    description: "Every customer with an outstanding balance in scope, ranked worst first, with risk level.",
    path: "/reports/debt-analysis/export",
    filename: "debt-analysis-report.csv",
    hasDateRange: false,
  },
];

function ReportCard({ report, territoryId }: { report: ReportDef; territoryId: number | undefined }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(e: FormEvent) {
    e.preventDefault();
    setDownloading(true);
    setError(null);
    try {
      await apiDownload(
        report.path,
        {
          territoryId,
          from: report.hasDateRange ? from || undefined : undefined,
          to: report.hasDateRange ? to || undefined : undefined,
          status: report.hasStatus ? status || undefined : undefined,
        },
        report.filename
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download this report.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Panel title={report.title} subtitle={report.description}>
      <form onSubmit={handleDownload} className="flex flex-wrap items-end gap-3">
        {report.hasDateRange && (
          <>
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </Field>
          </>
        )}
        {report.hasStatus && (
          <Field label={report.hasStatus.label}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              {report.hasStatus.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <button
          type="submit"
          disabled={downloading}
          className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
        >
          {downloading ? "Preparing…" : "Download CSV"}
        </button>
        {error && <p className="text-[12.5px] text-poor">{error}</p>}
      </form>
    </Panel>
  );
}

export function Reports() {
  const { user } = useAuth();
  const canView = user && (user.role === "admin" || user.role === "nsm" || user.role === "rsm");

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!canView) return;
    apiRequest<Territory[]>("/territories").then(setTerritories).catch(() => {});
  }, [canView]);

  if (!canView) {
    return (
      <div>
        <h1 className="font-serif text-2xl text-ink mb-2">Reports</h1>
        <p className="text-[13.5px] text-ink-soft">Report exports are available to managers and admins.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Reports</h1>
          <p className="text-[13.5px] text-ink-soft">Download CSV exports scoped to your territory or region</p>
        </div>
        <select
          className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px]"
          value={territoryId ?? ""}
          onChange={(e) => setTerritoryId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All territories in scope</option>
          {territories.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {REPORTS.map((r) => (
          <ReportCard key={r.key} report={r} territoryId={territoryId} />
        ))}
      </div>
    </div>
  );
}
