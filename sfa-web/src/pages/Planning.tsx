import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { VisitPlan, Product, RepSummary } from "../types/planning";
import { Customer } from "../types/customers";
import { Panel } from "../components/ui/Panel";
import { StatusTag } from "../components/ui/StatusTag";
import { Field, Input, Select, TextArea } from "../components/ui/Form";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Planning() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";

  const [plans, setPlans] = useState<VisitPlan[]>([]);
  const [reps, setReps] = useState<RepSummary[]>([]);
  const [repId, setRepId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-plan form state (reps only)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [productId, setProductId] = useState<number | "">("");
  const [plannedDate, setPlannedDate] = useState(todayISO());
  const [objective, setObjective] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<RepSummary[]>("/users/directory").then(setReps).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (isManager) return;
    apiRequest<{ data: Customer[] }>("/customers", { query: { pageSize: 100 } })
      .then((res) => setCustomers(res.data))
      .catch(() => {});
    apiRequest<{ data: Product[] }>("/products", { query: { pageSize: 100 } })
      .then((res) => setProducts(res.data))
      .catch(() => {});
  }, [isManager]);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<VisitPlan[]>("/visit-plans", { query: { repId } })
      .then(setPlans)
      .catch(() => setError("Could not load the call plan. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [repId]);

  const visiblePlans = useMemo(
    () => (statusFilter ? plans.filter((p) => p.status === statusFilter) : plans),
    [plans, statusFilter]
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!customerId || !plannedDate) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiRequest("/visit-plans", {
        method: "POST",
        body: {
          customerId: Number(customerId),
          plannedDate,
          productToDetailId: productId ? Number(productId) : undefined,
          objective: objective || undefined,
        },
      });
      setFormOpen(false);
      setCustomerId("");
      setProductId("");
      setObjective("");
      setPlannedDate(todayISO());
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create this plan.");
    } finally {
      setSubmitting(false);
    }
  }

  // "completed" is set automatically when a visit is logged against this plan
  // (see the Visits screen) — this action only ever marks a plan missed.
  async function updateStatus(planId: number, status: "missed") {
    try {
      await apiRequest(`/visit-plans/${planId}/status`, { method: "PATCH", body: { status } });
      load();
    } catch {
      setError("Could not update that plan's status.");
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Planning</h1>
          <p className="text-[13.5px] text-ink-soft">
            {isManager ? "Call plans across your reps" : "Your daily call plan"}
          </p>
        </div>
        {!isManager && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90"
          >
            {formOpen ? "Close" : "+ New plan"}
          </button>
        )}
      </div>

      {formOpen && !isManager && (
        <div className="mb-5">
          <Panel title="New call plan">
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Customer">
                <Select required value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Planned date">
                <Input
                  type="date"
                  required
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                />
              </Field>
              <Field label="Product to detail (optional)">
                <Select value={productId} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">None</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Objective (optional)">
                <TextArea rows={1} value={objective} onChange={(e) => setObjective(e.target.value)} />
              </Field>

              <div className="md:col-span-2 flex items-center justify-between mt-1">
                <div>{formError && <p className="text-[12.5px] text-poor">{formError}</p>}</div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Add to plan"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className="flex gap-2.5 mb-4">
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
        <select
          className="border border-border bg-panel rounded px-3 py-1.5 text-[12.5px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="completed">Completed</option>
          <option value="missed">Missed</option>
        </select>
      </div>

      <Panel title="Call plan" subtitle={`${visiblePlans.length} plan${visiblePlans.length === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : visiblePlans.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">No plans match this view.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                <th className="pb-2">Date</th>
                {isManager && <th className="pb-2">Rep</th>}
                <th className="pb-2">Customer</th>
                <th className="pb-2">Objective</th>
                <th className="pb-2">Status</th>
                {!isManager && <th className="pb-2"></th>}
              </tr>
            </thead>
            <tbody>
              {visiblePlans.map((p) => (
                <tr key={p.id} className="border-b border-[#EDEEE4] last:border-b-0">
                  <td className="py-2.5 whitespace-nowrap">
                    {new Date(p.planned_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                  </td>
                  {isManager && <td className="py-2.5">{p.rep_name}</td>}
                  <td className="py-2.5">{p.business_name}</td>
                  <td className="py-2.5 text-ink-soft">{p.objective || "—"}</td>
                  <td className="py-2.5">
                    <StatusTag status={p.status} />
                  </td>
                  {!isManager && (
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {p.status === "planned" && (
                        <>
                          <Link
                            to={`/visits?planId=${p.id}&customerId=${p.customer_id}`}
                            className="text-good hover:underline mr-3"
                          >
                            Log visit
                          </Link>
                          <button onClick={() => updateStatus(p.id, "missed")} className="text-poor hover:underline">
                            Mark missed
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
