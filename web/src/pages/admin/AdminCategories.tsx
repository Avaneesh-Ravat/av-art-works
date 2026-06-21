import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Category } from "../../types";
import { Spinner } from "../../components/Spinner";

export function AdminCategories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ items: Category[] }>("/v1/categories"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/v1/categories", { name, description }),
    onSuccess: () => {
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/v1/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  if (isLoading) return <Spinner />;
  const categories = data?.items ?? [];

  return (
    <div className="space-y-6">
      <form
        className="card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="font-semibold text-stone-800">Add category</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-4 px-6 py-2" disabled={create.isPending}>Create</button>
      </form>

      <div>
        <h2 className="font-semibold text-stone-800">Categories ({categories.length})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <div key={c.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-stone-800">{c.name}</p>
                <p className="text-sm text-stone-500">{c.description}</p>
              </div>
              <button className="text-sm text-red-500 hover:underline" onClick={() => del.mutate(c.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
