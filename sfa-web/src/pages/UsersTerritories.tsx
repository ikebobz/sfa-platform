import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AdminUser, Role, UserFormValues, emptyUserForm } from "../types/users";
import { Territory } from "../types/dashboard";
import { Panel } from "../components/ui/Panel";
import { Pagination } from "../components/ui/Pagination";
import { StatusTag } from "../components/ui/StatusTag";
import { Field, Input, Select } from "../components/ui/Form";

const PAGE_SIZE = 15;

const roleLabels: Record<Role, string> = {
  rep: "Sales rep",
  rsm: "Regional sales manager",
  nsm: "National sales manager",
  admin: "Admin",
};

function TerritoriesPanel({ territories, onChanged }: { territories: Territory[]; onChanged: () => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Territory | undefined>(undefined);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [state, setState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(undefined);
    setName("");
    setRegion("");
    setState("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(t: Territory) {
    setEditing(t);
    setName(t.name);
    setRegion(t.region);
    setState(t.state);
    setError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await apiRequest(`/territories/${editing.id}`, { method: "PATCH", body: { name, region, state } });
      } else {
        await apiRequest("/territories", { method: "POST", body: { name, region, state } });
      }
      setFormOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this territory.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel
      title="Territories"
      subtitle={`${territories.length} territor${territories.length === 1 ? "y" : "ies"}`}
      action={
        <button onClick={openCreate} className="text-accent text-[12.5px] hover:underline">
          + New territory
        </button>
      }
    >
      {formOpen && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pb-4 border-b border-border">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Region">
            <Input required value={region} onChange={(e) => setRegion(e.target.value)} />
          </Field>
          <Field label="State">
            <Input required value={state} onChange={(e) => setState(e.target.value)} />
          </Field>
          <div className="md:col-span-3 flex items-center justify-between">
            <div>{error && <p className="text-[12.5px] text-poor">{error}</p>}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="text-sm px-3 py-1.5 text-ink-soft hover:text-ink">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-ink text-white text-sm px-3 py-1.5 rounded hover:bg-ink/90 disabled:opacity-60"
              >
                {submitting ? "Saving…" : editing ? "Save changes" : "Add territory"}
              </button>
            </div>
          </div>
        </form>
      )}

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
            <th className="pb-2">Name</th>
            <th className="pb-2">Region</th>
            <th className="pb-2">State</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {territories.map((t) => (
            <tr key={t.id} className="border-b border-[#EDEEE4] last:border-b-0">
              <td className="py-2.5">{t.name}</td>
              <td className="py-2.5 text-ink-soft">{t.region}</td>
              <td className="py-2.5 text-ink-soft">{t.state}</td>
              <td className="py-2.5 text-right">
                <button onClick={() => openEdit(t)} className="text-accent hover:underline">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function UsersTerritories() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | undefined>(undefined);
  const [form, setForm] = useState<UserFormValues>(emptyUserForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function loadTerritories() {
    apiRequest<Territory[]>("/territories").then(setTerritories).catch(() => {});
  }

  function loadUsers() {
    setLoading(true);
    setError(null);
    apiRequest<{ data: AdminUser[]; total: number }>("/users", { query: { page, pageSize: PAGE_SIZE } })
      .then((res) => {
        setUsers(res.data);
        setTotal(res.total);
      })
      .catch(() => setError("Could not load users. Check your connection and try again."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadTerritories();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin, page]);

  function set<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setEditing(undefined);
    setForm(emptyUserForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      password: "",
      role: u.role,
      territoryId: u.territory_id ?? "",
      status: u.status,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const territoryId = form.territoryId === "" ? null : Number(form.territoryId);
      if (editing) {
        await apiRequest(`/users/${editing.id}`, {
          method: "PATCH",
          body: {
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            role: form.role,
            territoryId,
            status: form.status,
          },
        });
      } else {
        await apiRequest("/users", {
          method: "POST",
          body: {
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            password: form.password,
            role: form.role,
            territoryId,
          },
        });
      }
      setFormOpen(false);
      loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(u: AdminUser) {
    try {
      await apiRequest(`/users/${u.id}`, { method: "DELETE" });
      loadUsers();
    } catch {
      setError("Could not deactivate that user.");
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="font-serif text-2xl text-ink mb-2">Users & territories</h1>
        <p className="text-[13.5px] text-ink-soft">This screen is available to admins only.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-ink mb-1">Users & territories</h1>
          <p className="text-[13.5px] text-ink-soft">Manage staff accounts and the territory list</p>
        </div>
      </div>

      <div className="mb-5">
        <TerritoriesPanel territories={territories} onChanged={loadTerritories} />
      </div>

      {formOpen && (
        <div className="mb-5">
          <Panel title={editing ? `Edit ${editing.name}` : "New user"}>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name">
                <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>

              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              {!editing && (
                <Field label="Temporary password">
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                  />
                </Field>
              )}

              <Field label="Role">
                <Select required value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Territory">
                <Select
                  value={form.territoryId}
                  onChange={(e) => set("territoryId", e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">No territory (NSM/admin)</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {editing && (
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => set("status", e.target.value as "active" | "inactive")}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </Field>
              )}

              <div className="md:col-span-2 flex items-center justify-between mt-1">
                <div>{formError && <p className="text-[12.5px] text-poor">{formError}</p>}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormOpen(false)} className="text-sm px-4 py-2 text-ink-soft hover:text-ink">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-ink text-white text-sm px-4 py-2 rounded hover:bg-ink/90 disabled:opacity-60"
                  >
                    {submitting ? "Saving…" : editing ? "Save changes" : "Add user"}
                  </button>
                </div>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <Panel
        title="Users"
        subtitle={`${total} account${total === 1 ? "" : "s"}`}
        action={
          <button onClick={openCreate} className="text-accent text-[12.5px] hover:underline">
            + New user
          </button>
        }
      >
        {loading ? (
          <p className="text-[12.5px] text-ink-soft">Loading…</p>
        ) : error ? (
          <p className="text-[12.5px] text-poor">{error}</p>
        ) : (
          <>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-soft border-b border-border">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Territory</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#EDEEE4] last:border-b-0">
                    <td className="py-2.5">{u.name}</td>
                    <td className="py-2.5 text-ink-soft">{u.email}</td>
                    <td className="py-2.5">{roleLabels[u.role]}</td>
                    <td className="py-2.5 text-ink-soft">
                      {territories.find((t) => t.id === u.territory_id)?.name ?? "—"}
                    </td>
                    <td className="py-2.5">
                      <StatusTag status={u.status} />
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(u)} className="text-accent hover:underline mr-3">
                        Edit
                      </button>
                      {u.status === "active" && u.id !== currentUser?.id && (
                        <button onClick={() => deactivate(u)} className="text-poor hover:underline">
                          Deactivate
                        </button>
                      )}
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
