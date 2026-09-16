import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Customer, CustomerFormValues } from "../types/customers";
import { Territory } from "../types/dashboard";
import { Panel } from "../components/ui/Panel";
import { StatusTag } from "../components/ui/StatusTag";
import { Pagination } from "../components/ui/Pagination";
import { CustomerForm } from "../components/CustomerForm";

const PAGE_SIZE = 15;

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

export function Customers() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoryId, setTerritoryId] = useState<number | undefined>(user?.territory_id ?? undefined);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<"none" | "create" | "edit">("none");
  const [editing, setEditing] = useState<Customer | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<Territory[]>("/territories").then(setTerritories).catch(() => {});
  }, [isManager]);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<{ data: Customer[]; total: number }>("/customers", {
      query: { page, pageSize: PAGE_SIZE, search: search || undefined, status: status || undefined, territoryId },
    })
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load customers. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, search, status, territoryId]);

  // Reset to page 1 whenever a filter changes underneath the current page.
  useEffect(() => setPage(1), [search, status, territoryId]);

  function openCreate() {
    setEditing(undefined);
    setSaveError(null);
    setPanelMode("create");
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setSaveError(null);
    setPanelMode("edit");
  }

  async function handleSubmit(values: CustomerFormValues) {
    setSaving(true);
    setSaveError(null);
    const payload = {
      businessName: values.businessName,
      businessType: values.businessType || undefined,
      address: values.address || undefined,
      town: values.town || undefined,
      lga: values.lga || undefined,
      state: values.state || undefined,
      region: values.region || undefined,
      contactPerson: values.contactPerson || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      territoryId: values.territoryId === "" ? undefined : Number(values.territoryId),
    };

    try {
      if (panelMode === "create") {
        await apiRequest("/customers", { method: "POST", body: payload });
      } else if (editing) {
        await apiRequest(`/customers/${editing.id}`, { method: "PATCH", body: payload });
      }
      setPanelMode("none");
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save this customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Customers</h1>
          <p className="text-[13.5px] text-ink-soft">The territory customer database</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90"
        >
          + New customer
        </button>
      </div>

      {panelMode !== "none" && (
        <div className="mb-5">
          <CustomerForm
            mode={panelMode}
            initial={editing}
            territories={territories}
            lockTerritoryId={!isManager ? user?.territory_id ?? undefined : undefined}
            onCancel={() => setPanelMode("none")}
            onSubmit={handleSubmit}
            submitting={saving}
            error={saveError}
          />
        </div>
      )}

      <div className="flex gap-2.5 mb-4">
        <input
          type="text"
          placeholder="Search business name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px] w-64"
        />
        <select
          className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
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
      </div>

      <Panel title="Customer list" subtitle={`${total} customer${total === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">No customers match this view.</p>
        ) : (
          <>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Business</th>
                  <th className="pb-2">Town / State</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Last visit</th>
                  <th className="pb-2">Last supply</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2.5">
                      <div>{c.business_name}</div>
                      {c.business_type && <div className="text-[11px] text-ink-soft">{c.business_type}</div>}
                    </td>
                    <td className="py-2.5 text-ink-soft">
                      {[c.town, c.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-2.5">
                      <StatusTag status={c.status} />
                    </td>
                    <td className="py-2.5 text-ink-soft">{formatDate(c.last_visit_date)}</td>
                    <td className="py-2.5 text-ink-soft">{formatDate(c.last_supply_date)}</td>
                    <td className="py-2.5 text-right">
                      <button onClick={() => openEdit(c)} className="text-accent hover:underline">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
