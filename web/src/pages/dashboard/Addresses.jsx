import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Spinner } from "../../components/Spinner";

const empty = { line1: "", line2: "", city: "", state: "", pincode: "", is_default: false };

export function Addresses() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get("/v1/users/me/addresses"),
  });

  const add = useMutation({
    mutationFn: () => api.post("/v1/users/me/addresses", form),
    onSuccess: () => {
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/v1/users/me/addresses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  if (isLoading) return <Spinner />;
  const addresses = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">Saved addresses</h2>
        {addresses.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-stone-300 py-10 text-center text-stone-500">
            No saved addresses.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <div key={a.id} className="card p-4 text-sm">
                <div className="flex items-start justify-between">
                  <p className="font-medium text-ink">{a.line1}</p>
                  {a.is_default && <span className="pill-muted">Default</span>}
                </div>
                {a.line2 && <p className="text-stone-600">{a.line2}</p>}
                <p className="text-stone-600">{a.city}, {a.state} {a.pincode}</p>
                <p className="text-stone-400">{a.country}</p>
                <button className="mt-3 block text-xs font-medium text-red-500 transition hover:text-red-600 hover:underline" onClick={() => remove.mutate(a.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        className="card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <h3 className="font-display text-lg font-bold text-ink">Add address</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Address line 1</label>
            <input className="input" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          </div>
          <div><label className="label">City</label>
            <input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="label">State</label>
            <input className="input" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div><label className="label">Pincode</label>
            <input className="input" required value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Set as default
          </label>
        </div>
        <button className="btn-primary mt-4 px-6 py-2" disabled={add.isPending}>Add address</button>
      </form>
    </div>
  );
}
