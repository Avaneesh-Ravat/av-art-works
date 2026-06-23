import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { Spinner } from "../../components/Spinner";
import { AddressForm, emptyAddress } from "../../components/AddressForm";

export function Addresses() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyAddress, is_default: false });
  const [error, setError] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get("/v1/users/me/addresses"),
  });

  const add = useMutation({
    mutationFn: () =>
      api.post("/v1/users/me/addresses", {
        line1: form.line1,
        line2: form.line2 ?? "",
        locality: form.locality,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        country: "India",
        is_default: form.is_default,
      }),
    onSuccess: () => {
      setForm({ ...emptyAddress, is_default: false });
      setError("");
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save address."),
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
                {a.locality && <p className="text-stone-600">{a.locality}</p>}
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
          setError("");
          if (!form.line1.trim() || !form.locality || !form.city || !form.state || form.pincode.length !== 6) {
            setError("Please complete and verify your address.");
            return;
          }
          add.mutate();
        }}
      >
        <h3 className="font-display text-lg font-bold text-ink">Add address</h3>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-4">
          <AddressForm value={form} onChange={setForm} idPrefix="saved" />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Set as default
        </label>
        <button className="btn-primary mt-4 px-6 py-2" disabled={add.isPending}>Add address</button>
      </form>
    </div>
  );
}
