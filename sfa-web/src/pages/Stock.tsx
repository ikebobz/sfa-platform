import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { StockBalance, StockReceipt, ReceiptFormValues } from "../types/stock";
import { Product, RepSummary } from "../types/planning";
import { Panel } from "../components/ui/Panel";
import { Field, Input, Select, TextArea } from "../components/ui/Form";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: ReceiptFormValues = {
  productId: "",
  quantity: "",
  receivedDate: todayISO(),
  notes: "",
};

export function Stock() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";

  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reps, setReps] = useState<RepSummary[]>([]);
  const [repId, setRepId] = useState<number | undefined>(undefined);

  const [products, setProducts] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ReceiptFormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formResult, setFormResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<RepSummary[]>("/users/directory").then(setReps).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (isManager) return;
    apiRequest<{ data: Product[] }>("/products", { query: { pageSize: 100 } })
      .then((res) => setProducts(res.data))
      .catch(() => {});
  }, [isManager]);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<StockBalance[]>("/stock/balances", { query: { repId } }),
      apiRequest<StockReceipt[]>("/stock/receipts", { query: { repId } }),
    ])
      .then(([b, r]) => {
        setBalances(b);
        setReceipts(r);
      })
      .catch(() => setError("Could not load stock data. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [repId]);

  function set<K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.productId || !form.quantity) return;
    setSubmitting(true);
    setFormError(null);
    setFormResult(null);
    try {
      const res = await apiRequest<{ quantityOnHand: number }>("/stock/receipts", {
        method: "POST",
        body: {
          productId: Number(form.productId),
          quantity: Number(form.quantity),
          receivedDate: form.receivedDate,
          notes: form.notes || undefined,
        },
      });
      setFormResult(`Logged. New balance for this product: ${res.quantityOnHand} unit(s).`);
      setForm({ ...emptyForm, receivedDate: form.receivedDate });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not log this stock receipt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Stock</h1>
          <p className="text-[13.5px] text-ink-soft">
            {isManager
              ? "Current stock on hand across your reps"
              : "Stock you've received from the office, and what you currently have on hand"}
          </p>
        </div>
        {!isManager && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90"
          >
            {formOpen ? "Close" : "+ Log stock received"}
          </button>
        )}
      </div>

      {formOpen && !isManager && (
        <div className="mb-5">
          <Panel title="Log stock received from the office">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Product">
                <Select required value={form.productId} onChange={(e) => set("productId", Number(e.target.value))}>
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantity received">
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>

              <Field label="Date received">
                <Input
                  type="date"
                  required
                  value={form.receivedDate}
                  onChange={(e) => set("receivedDate", e.target.value)}
                />
              </Field>
              <Field label="Notes (optional)">
                <TextArea rows={1} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>

              <div className="md:col-span-2 flex items-center justify-between mt-1">
                <div>
                  {formError && <p className="text-[12.5px] text-poor">{formError}</p>}
                  {formResult && <p className="text-[12.5px] text-good">{formResult}</p>}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Log receipt"}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Current balance" subtitle="Units on hand right now, by product">
          {loading ? (
            <p className="text-[12.5px] text-ink-soft">Loading…</p>
          ) : error ? (
            <p className="text-[12.5px] text-poor">{error}</p>
          ) : balances.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">No stock on hand yet — log a receipt above to get started.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  {isManager && <th className="pb-2">Rep</th>}
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">On hand</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={`${b.rep_id}-${b.product_id}`} className="border-b border-[#EDEEE4] last:border-b-0">
                    {isManager && <td className="py-2.5">{b.rep_name}</td>}
                    <td className="py-2.5">{b.product_name}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{b.quantity_on_hand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Receipt history" subtitle="Stock logged as received from the office">
          {loading ? (
            <p className="text-[12.5px] text-ink-soft">Loading…</p>
          ) : receipts.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">No receipts logged yet.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Date</th>
                  {isManager && <th className="pb-2">Rep</th>}
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2.5 whitespace-nowrap">
                      {new Date(r.received_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                    </td>
                    {isManager && <td className="py-2.5">{r.rep_name}</td>}
                    <td className="py-2.5">{r.product_name}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
