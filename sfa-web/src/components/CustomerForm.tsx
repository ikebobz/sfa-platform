import { FormEvent, useEffect, useState } from "react";
import { Panel } from "./ui/Panel";
import { Field, Input, Select } from "./ui/Form";
import { Customer, CustomerFormValues, emptyCustomerForm } from "../types/customers";
import { Territory } from "../types/dashboard";

export function CustomerForm({
  mode,
  initial,
  territories,
  lockTerritoryId,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  mode: "create" | "edit";
  initial?: Customer;
  territories: Territory[];
  /** When set (e.g. a rep's own territory), the territory field is fixed and hidden from choice. */
  lockTerritoryId?: number;
  onCancel: () => void;
  onSubmit: (values: CustomerFormValues) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [values, setValues] = useState<CustomerFormValues>(emptyCustomerForm);

  useEffect(() => {
    if (initial) {
      setValues({
        businessName: initial.business_name,
        businessType: initial.business_type ?? "",
        address: initial.address ?? "",
        town: initial.town ?? "",
        lga: initial.lga ?? "",
        state: initial.state ?? "",
        region: initial.region ?? "",
        contactPerson: initial.contact_person ?? "",
        phone: initial.phone ?? "",
        email: initial.email ?? "",
        territoryId: initial.territory_id,
      });
    } else if (lockTerritoryId) {
      setValues((v) => ({ ...v, territoryId: lockTerritoryId }));
    }
  }, [initial, lockTerritoryId]);

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <Panel title={mode === "create" ? "New customer" : `Edit ${initial?.business_name ?? "customer"}`}>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Business name">
          <Input
            required
            value={values.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            placeholder="e.g. Grace Pharmacy"
          />
        </Field>
        <Field label="Business type">
          <Input
            value={values.businessType}
            onChange={(e) => set("businessType", e.target.value)}
            placeholder="Pharmacy, Hospital, PMS…"
          />
        </Field>

        <Field label="Contact person">
          <Input value={values.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>

        <Field label="Address">
          <Input value={values.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
        </Field>

        <Field label="Town">
          <Input value={values.town} onChange={(e) => set("town", e.target.value)} />
        </Field>
        <Field label="LGA">
          <Input value={values.lga} onChange={(e) => set("lga", e.target.value)} />
        </Field>

        <Field label="State">
          <Input value={values.state} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="Region">
          <Input value={values.region} onChange={(e) => set("region", e.target.value)} />
        </Field>

        <Field label="Territory">
          {lockTerritoryId ? (
            <Select disabled value={lockTerritoryId}>
              <option value={lockTerritoryId}>
                {territories.find((t) => t.id === lockTerritoryId)?.name ?? "Loading…"}
              </option>
            </Select>
          ) : (
            <Select
              required
              value={values.territoryId}
              onChange={(e) => set("territoryId", Number(e.target.value))}
            >
              <option value="">Select a territory…</option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="md:col-span-2 flex items-center justify-between mt-1">
          <div>{error && <p className="text-[12.5px] text-poor">{error}</p>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="text-sm px-4 py-2 text-ink-soft hover:text-ink">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
            >
              {submitting ? "Saving…" : mode === "create" ? "Add customer" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
