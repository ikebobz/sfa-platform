import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Expense, ExpenseFormValues } from "../types/expenses";
import { RepSummary } from "../types/planning";
import { Panel } from "../components/ui/Panel";
import { Pagination } from "../components/ui/Pagination";
import { StatusTag } from "../components/ui/StatusTag";
import { Field, Input } from "../components/ui/Form";

const PAGE_SIZE = 15;
const MONTHLY_EXPENSE_LIMIT = 100_000; // mirrors backend expenses.routes.ts — see web README

function nairaFull(amount: number): string {
  return `₦${Number(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

const emptyForm: ExpenseFormValues = {
  expenseDate: new Date().toISOString().slice(0, 10),
  fuelAmount: "",
  litres: "",
  odometerKm: "",
  vehicleServiceCost: "",
  otherCost: "",
  receiptPhotoUrl: "",
};

export function Expenses() {
  const { user } = useAuth();
  const isManager = user && (user.role === "rsm" || user.role === "admin" || user.role === "nsm");
  const canDecide = user && (user.role === "rsm" || user.role === "admin");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reps, setReps] = useState<RepSummary[]>([]);
  const [repId, setRepId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string>(isManager ? "pending" : "");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formResult, setFormResult] = useState<{ message: string; overLimit: boolean } | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<RepSummary[]>("/users/directory").then(setReps).catch(() => {});
  }, [isManager]);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<{ data: Expense[]; total: number }>("/expenses", {
      query: { page, pageSize: PAGE_SIZE, repId, status: status || undefined },
    })
      .then((res) => {
        setExpenses(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load expenses. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, repId, status]);
  useEffect(() => setPage(1), [repId, status]);

  function set<K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFormResult(null);
    try {
      const res = await apiRequest<{ totalCost: number; monthToDateTotal: number; overLimit: boolean }>(
        "/expenses",
        {
          method: "POST",
          body: {
            expenseDate: form.expenseDate,
            fuelAmount: Number(form.fuelAmount || 0),
            litres: form.litres ? Number(form.litres) : undefined,
            odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined,
            vehicleServiceCost: Number(form.vehicleServiceCost || 0),
            otherCost: Number(form.otherCost || 0),
            receiptPhotoUrl: form.receiptPhotoUrl || undefined,
          },
        }
      );
      setFormResult({
        message: `Logged ${nairaFull(res.totalCost)}. Month to date: ${nairaFull(res.monthToDateTotal)}.`,
        overLimit: res.overLimit,
      });
      setForm({ ...emptyForm, expenseDate: form.expenseDate });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not log this expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(id: number, decision: "approved" | "rejected") {
    try {
      await apiRequest(`/expenses/${id}/decision`, { method: "PATCH", body: { decision } });
      load();
    } catch {
      setError("Could not update that expense's approval status.");
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Expenses</h1>
          <p className="text-[13.5px] text-ink-soft">
            {isManager ? "Expense approvals across your reps" : "Log field expenses and track your monthly limit"}
          </p>
        </div>
        {!isManager && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90"
          >
            {formOpen ? "Close" : "+ Log an expense"}
          </button>
        )}
      </div>

      {formOpen && !isManager && (
        <div className="mb-5">
          <Panel title="Log an expense">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Date">
                <Input
                  type="date"
                  required
                  value={form.expenseDate}
                  onChange={(e) => set("expenseDate", e.target.value)}
                />
              </Field>
              <Field label="Fuel amount (₦)">
                <Input
                  type="number"
                  min={0}
                  value={form.fuelAmount}
                  onChange={(e) => set("fuelAmount", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>

              <Field label="Litres (optional)">
                <Input
                  type="number"
                  min={0}
                  value={form.litres}
                  onChange={(e) => set("litres", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
              <Field label="Odometer reading, km (optional)">
                <Input
                  type="number"
                  min={0}
                  value={form.odometerKm}
                  onChange={(e) => set("odometerKm", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>

              <Field label="Vehicle service cost (₦)">
                <Input
                  type="number"
                  min={0}
                  value={form.vehicleServiceCost}
                  onChange={(e) => set("vehicleServiceCost", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
              <Field label="Other cost (₦)">
                <Input
                  type="number"
                  min={0}
                  value={form.otherCost}
                  onChange={(e) => set("otherCost", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>

              <Field label="Receipt photo URL (optional)">
                <Input
                  type="url"
                  placeholder="https://…"
                  value={form.receiptPhotoUrl}
                  onChange={(e) => set("receiptPhotoUrl", e.target.value)}
                />
              </Field>

              <div className="md:col-span-2 flex items-center justify-between mt-1">
                <div>
                  {formError && <p className="text-[12.5px] text-poor">{formError}</p>}
                  {formResult && (
                    <p className={`text-[12.5px] ${formResult.overLimit ? "text-poor" : "text-good"}`}>
                      {formResult.message}
                      {formResult.overLimit && " Above the monthly limit."}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Log expense"}
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <Panel title="Expense log" subtitle={`${total} record${total === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : expenses.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">No expenses match this view.</p>
        ) : (
          <>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Date</th>
                  {isManager && <th className="pb-2">Rep</th>}
                  <th className="pb-2 text-right">Fuel</th>
                  <th className="pb-2 text-right">Service</th>
                  <th className="pb-2 text-right">Other</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2">Status</th>
                  {canDecide && <th className="pb-2"></th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2.5 whitespace-nowrap">
                      {new Date(e.expense_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                    </td>
                    {isManager && <td className="py-2.5">{e.rep_name}</td>}
                    <td className="py-2.5 text-right tabular-nums">{nairaFull(e.fuel_amount)}</td>
                    <td className="py-2.5 text-right tabular-nums">{nairaFull(e.vehicle_service_cost)}</td>
                    <td className="py-2.5 text-right tabular-nums">{nairaFull(e.other_cost)}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{nairaFull(e.total_cost)}</td>
                    <td className="py-2.5">
                      <StatusTag status={e.approval_status} />
                    </td>
                    {canDecide && (
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {e.approval_status === "pending" && (
                          <>
                            <button
                              onClick={() => decide(e.id, "approved")}
                              className="text-good hover:underline mr-3"
                            >
                              Approve
                            </button>
                            <button onClick={() => decide(e.id, "rejected")} className="text-poor hover:underline">
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    )}
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
