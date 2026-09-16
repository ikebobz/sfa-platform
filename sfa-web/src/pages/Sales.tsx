import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Sale, SaleFormValues, PaymentStatus } from "../types/sales";
import { Customer } from "../types/customers";
import { Product, RepSummary } from "../types/planning";
import { Panel } from "../components/ui/Panel";
import { Pagination } from "../components/ui/Pagination";
import { Field, Input, Select } from "../components/ui/Form";

const PAGE_SIZE = 15;

function nairaFull(amount: number): string {
  return `₦${Number(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

const paymentLabels: Record<PaymentStatus, string> = {
  full_payment: "Full payment",
  part_payment: "Part payment",
  credit: "Credit",
};

const emptyForm: SaleFormValues = {
  customerId: "",
  productId: "",
  quantity: "",
  paymentStatus: "full_payment",
  amountPaid: "",
  saleDate: new Date().toISOString().slice(0, 10),
};

export function SalesRedistribution() {
  const { user } = useAuth();
  const isManager = user && user.role !== "rep";

  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reps, setReps] = useState<RepSummary[]>([]);
  const [repId, setRepId] = useState<number | undefined>(undefined);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SaleFormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formResult, setFormResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    apiRequest<RepSummary[]>("/users/directory").then(setReps).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    if (isManager) return;
    apiRequest<{ data: Customer[] }>("/customers", { query: { pageSize: 100, status: "active" } })
      .then((res) => setCustomers(res.data))
      .catch(() => {});
    apiRequest<{ data: Product[] }>("/products", { query: { pageSize: 100 } })
      .then((res) => setProducts(res.data))
      .catch(() => {});
  }, [isManager]);

  function load() {
    setLoading(true);
    setError(null);
    apiRequest<{ data: Sale[]; total: number }>("/sales", {
      query: { page, pageSize: PAGE_SIZE, repId },
    })
      .then((res) => {
        setSales(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load sales. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, repId]);
  useEffect(() => setPage(1), [repId]);

  function set<K extends keyof SaleFormValues>(key: K, value: SaleFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedProduct = products.find((p) => p.id === form.productId);
  const estimatedRevenue =
    selectedProduct && form.quantity ? Number(selectedProduct.unit_price) * Number(form.quantity) : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.productId || !form.quantity) return;
    setSubmitting(true);
    setFormError(null);
    setFormResult(null);
    try {
      const res = await apiRequest<{ id: number; revenue: number; amountPaid: number }>("/sales", {
        method: "POST",
        body: {
          customerId: Number(form.customerId),
          productId: Number(form.productId),
          quantity: Number(form.quantity),
          paymentStatus: form.paymentStatus,
          amountPaid: form.paymentStatus === "part_payment" ? Number(form.amountPaid || 0) : undefined,
          saleDate: form.saleDate,
        },
      });
      setFormResult(`Recorded — ${nairaFull(res.revenue)} revenue, ${nairaFull(res.amountPaid)} paid.`);
      setForm({ ...emptyForm, saleDate: form.saleDate });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not record this sale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Sales & redistribution</h1>
          <p className="text-[13.5px] text-ink-soft">
            {isManager ? "Sales recorded across your reps" : "Record a sale and see your history"}
          </p>
        </div>
        {!isManager && (
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90"
          >
            {formOpen ? "Close" : "+ Record a sale"}
          </button>
        )}
      </div>

      {formOpen && !isManager && (
        <div className="mb-5">
          <Panel title="Record a sale">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Customer">
                <Select
                  required
                  value={form.customerId}
                  onChange={(e) => set("customerId", Number(e.target.value))}
                >
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.business_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Product">
                <Select required value={form.productId} onChange={(e) => set("productId", Number(e.target.value))}>
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {nairaFull(p.unit_price)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Quantity">
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value ? Number(e.target.value) : "")}
                />
              </Field>
              <Field label="Sale date">
                <Input
                  type="date"
                  required
                  value={form.saleDate}
                  onChange={(e) => set("saleDate", e.target.value)}
                />
              </Field>

              <Field label="Payment status">
                <Select
                  value={form.paymentStatus}
                  onChange={(e) => set("paymentStatus", e.target.value as PaymentStatus)}
                >
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              {form.paymentStatus === "part_payment" && (
                <Field label="Amount paid">
                  <Input
                    type="number"
                    min={0}
                    required
                    value={form.amountPaid}
                    onChange={(e) => set("amountPaid", e.target.value ? Number(e.target.value) : "")}
                  />
                </Field>
              )}

              {estimatedRevenue > 0 && (
                <div className="md:col-span-2 text-[12.5px] text-ink-soft">
                  Estimated revenue: <span className="text-ink tabular-nums">{nairaFull(estimatedRevenue)}</span>
                </div>
              )}

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
                  {submitting ? "Recording…" : "Record sale"}
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

      <Panel title="Sales history" subtitle={`${total} sale${total === 1 ? "" : "s"}`}>
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : sales.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">No sales recorded in this view yet.</p>
        ) : (
          <>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Date</th>
                  {isManager && <th className="pb-2">Rep</th>}
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2">Payment</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2.5 whitespace-nowrap">
                      {new Date(s.sale_date).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}
                    </td>
                    {isManager && <td className="py-2.5">{s.rep_name}</td>}
                    <td className="py-2.5">{s.business_name}</td>
                    <td className="py-2.5">{s.product_name}</td>
                    <td className="py-2.5 text-right tabular-nums">{s.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums">{nairaFull(s.revenue)}</td>
                    <td className="py-2.5 text-ink-soft">{paymentLabels[s.payment_status]}</td>
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
