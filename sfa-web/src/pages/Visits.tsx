import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { VisitLog, VisitLogFormValues, VISIT_ACTIVITY_OPTIONS, VisitActivityType } from "../types/visits";
import { Customer } from "../types/customers";
import { Product, VisitPlan, RepSummary } from "../types/planning";
import { Panel } from "../components/ui/Panel";
import { Pagination } from "../components/ui/Pagination";
import { Field, Input, Select, TextArea } from "../components/ui/Form";

const PAGE_SIZE = 15;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: VisitLogFormValues = {
  planId: "",
  customerId: "",
  visitDate: todayISO(),
  notes: "",
  activities: [],
  productsDiscussed: [],
};

export function Visits() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";
  const [searchParams] = useSearchParams();

  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reps, setReps] = useState<RepSummary[]>([]);
  const [repId, setRepId] = useState<number | undefined>(undefined);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openPlans, setOpenPlans] = useState<VisitPlan[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<VisitLogFormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formResult, setFormResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<RepSummary[]>("/users/directory").then(setReps).catch(() => {});
  }, [isManager]);

  function loadOpenPlans() {
    apiRequest<VisitPlan[]>("/visit-plans", { query: { status: "planned" } })
      .then(setOpenPlans)
      .catch(() => {});
  }

  useEffect(() => {
    apiRequest<{ data: Product[] }>("/products", { query: { pageSize: 100 } })
      .then((res) => setProducts(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isManager) return;
    apiRequest<{ data: Customer[] }>("/customers", { query: { pageSize: 100, status: "active" } })
      .then((res) => setCustomers(res.data))
      .catch(() => {});
    loadOpenPlans();
  }, [isManager]);

  // Pre-fill and open the form when arriving from Planning's "Log visit" link
  // (e.g. /visits?planId=12&customerId=4).
  useEffect(() => {
    const planId = searchParams.get("planId");
    const customerId = searchParams.get("customerId");
    if (planId || customerId) {
      setForm((f) => ({
        ...f,
        planId: planId ? Number(planId) : f.planId,
        customerId: customerId ? Number(customerId) : f.customerId,
      }));
      setFormOpen(true);
    }
  }, [searchParams]);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<{ data: VisitLog[]; total: number }>("/visit-logs", {
      query: { page, pageSize: PAGE_SIZE, repId },
    })
      .then((res) => {
        setVisits(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load visits. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, repId]);
  useEffect(() => setPage(1), [repId]);

  function toggleActivity(value: VisitActivityType) {
    setForm((f) => ({
      ...f,
      activities: f.activities.includes(value) ? f.activities.filter((a) => a !== value) : [...f.activities, value],
    }));
  }

  function toggleProduct(id: number) {
    setForm((f) => ({
      ...f,
      productsDiscussed: f.productsDiscussed.includes(id)
        ? f.productsDiscussed.filter((p) => p !== id)
        : [...f.productsDiscussed, id],
    }));
  }

  function selectPlan(rawValue: string) {
    const planId = rawValue ? Number(rawValue) : "";
    const plan = openPlans.find((p) => p.id === planId);
    setForm((f) => ({ ...f, planId, customerId: plan ? plan.customer_id : f.customerId }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.visitDate) return;
    setSubmitting(true);
    setFormError(null);
    setFormResult(null);
    try {
      await apiRequest("/visit-logs", {
        method: "POST",
        body: {
          planId: form.planId || undefined,
          customerId: Number(form.customerId),
          visitDate: form.visitDate,
          notes: form.notes || undefined,
          activities: form.activities,
          productsDiscussed: form.productsDiscussed,
        },
      });
      setFormResult("Visit logged.");
      setForm({ ...emptyForm, visitDate: form.visitDate });
      loadOpenPlans(); // a linked plan is now completed, drop it from the picker
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not log this visit.");
    } finally {
      setSubmitting(false);
    }
  }

  const activityLabelByValue = useMemo(
    () => Object.fromEntries(VISIT_ACTIVITY_OPTIONS.map((a) => [a.value, a.label])),
    []
  );
  const productNameById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.name])), [products]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Visits</h1>
          <p className="text-[13.5px] text-ink-soft">
            {isManager ? "Visit history across your reps" : "Log today's visits and what happened at each one"}
          </p>
        </div>
        {!isManager && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90"
          >
            {formOpen ? "Close" : "+ Log a visit"}
          </button>
        )}
      </div>

      {formOpen && !isManager && (
        <div className="mb-5">
          <Panel title="Log a visit">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Link to a planned visit (optional)">
                  <Select value={form.planId} onChange={(e) => selectPlan(e.target.value)}>
                    <option value="">Not linked to a plan</option>
                    {openPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.business_name} — {new Date(p.planned_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Customer">
                  <Select
                    required
                    value={form.customerId}
                    onChange={(e) => setForm((f) => ({ ...f, customerId: Number(e.target.value) }))}
                  >
                    <option value="">Select a customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.business_name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Visit date">
                  <Input
                    type="date"
                    required
                    value={form.visitDate}
                    onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
                  />
                </Field>
              </div>

              <Field label="Activities carried out">
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                  {VISIT_ACTIVITY_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 text-[12.5px] text-ink">
                      <input
                        type="checkbox"
                        checked={form.activities.includes(opt.value)}
                        onChange={() => toggleActivity(opt.value)}
                        className="accent-ink"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Products discussed (optional)">
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1 max-h-28 overflow-y-auto">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-1.5 text-[12.5px] text-ink">
                      <input
                        type="checkbox"
                        checked={form.productsDiscussed.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="accent-ink"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </Field>

              <Field label="Notes (optional)">
                <TextArea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="What came up, objections raised, follow-up needed…"
                />
              </Field>

              <div className="flex items-center justify-between">
                <div>
                  {formError && <p className="text-[12.5px] text-poor">{formError}</p>}
                  {formResult && <p className="text-[12.5px] text-good">{formResult}</p>}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Log visit"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      {isManager && (
        <div className="flex gap-2.5 mb-4">
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
        </div>
      )}

      <Panel title="Visit history" subtitle={`${total} visit${total === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : visits.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">No visits logged in this view yet.</p>
        ) : (
          <>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Date</th>
                  {isManager && <th className="pb-2">Rep</th>}
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Activities</th>
                  <th className="pb-2">Products discussed</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-b border-[#EDEEE4] last:border-b-0 align-top">
                    <td className="py-2.5 whitespace-nowrap">
                      {new Date(v.visit_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                    </td>
                    {isManager && <td className="py-2.5">{v.rep_name}</td>}
                    <td className="py-2.5">{v.business_name}</td>
                    <td className="py-2.5 text-ink-soft max-w-[220px]">
                      {v.activities.length
                        ? v.activities.map((a) => activityLabelByValue[a] ?? a).join(", ")
                        : "—"}
                    </td>
                    <td className="py-2.5 text-ink-soft max-w-[220px]">
                      {v.products_discussed.length
                        ? v.products_discussed.map((id) => productNameById[id] ?? `#${id}`).join(", ")
                        : "—"}
                    </td>
                    <td className="py-2.5 text-ink-soft max-w-[260px] whitespace-normal">{v.notes || "—"}</td>
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
