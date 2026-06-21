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
        <h2 className="font-semibold text-stone-800">Saved addresses</h2>
        {addresses.length === 0 ? (
          <p className="mt-3 text-stone-500">No saved addresses.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <div key={a.id} className="card p-4 text-sm">
                <p className="font-medium text-stone-800">{a.line1}</p>
                {a.line2 && <p>{a.line2}</p>}
                <p>{a.city}, {a.state} {a.pincode}</p>
                <p className="text-stone-500">{a.country}</p>
                {a.is_default && <span className="mt-1 inline-block text-xs text-brand-700">Default</span>}
                <button className="mt-2 block text-xs text-red-500 hover:underline" onClick={() => remove.mutate(a.id)}>
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
        <h3 className="font-semibold text-stone-800">Add address</h3>
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
