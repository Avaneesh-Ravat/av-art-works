import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, uploadImages } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { Spinner } from "../../components/Spinner";

const mediums = ["resin", "texture", "acrylic", "custom", "handmade"];
const emptyForm = { title: "", description: "", price: "", medium: "resin", stock: "0", category_id: "" };

const fileInputClass =
  "block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700";

export function AdminProducts() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [imageUrls, setImageUrls] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => api.get("/v1/products?limit=100&sort=newest"),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/v1/categories"),
  });

  const editingProduct = editing ? data?.items?.find((p) => p.id === editing) : undefined;

  const { data: editingFull } = useQuery({
    queryKey: ["product", editingProduct?.slug],
    queryFn: () => api.get(`/v1/products/${editingProduct.slug}`),
    enabled: !!editingProduct?.slug,
  });

  const reset = () => {
    setForm(emptyForm);
    setImageUrls("");
    setFiles([]);
    setFileInputKey((k) => k + 1);
    setEditing(null);
    setError("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        medium: form.medium,
        stock: Number(form.stock),
        category_id: form.category_id || undefined,
        is_active: true,
      };

      let productId = editing;
      if (editing) {
        await api.put(`/v1/products/${editing}`, payload);
      } else {
        const created = await api.post("/v1/products", payload);
        productId = created.id;
      }

      if (!productId) throw new ApiError(500, "internal", "product id missing after save");

      const keys = [];
      if (files.length > 0) {
        keys.push(...(await uploadImages(files)));
      }
      keys.push(...imageUrls.split("\n").map((s) => s.trim()).filter(Boolean));

      if (keys.length > 0) {
        await api.post(`/v1/products/${productId}/images/batch`, { s3_keys: keys });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      reset();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: (id) => api.del(`/v1/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  const startEdit = (p) => {
    setEditing(p.id);
    setImageUrls("");
    setFiles([]);
    setFileInputKey((k) => k + 1);
    setForm({
      title: p.title,
      description: p.description,
      price: String(p.price),
      medium: p.medium,
      stock: String(p.stock),
      category_id: p.category_id ?? "",
    });
  };

  const removePendingFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) return <Spinner />;
  const products = data?.items ?? [];
  const existingImages = editingFull?.images ?? editingProduct?.images ?? [];

  return (
    <div className="space-y-8">
      <form
        className="card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="font-semibold text-stone-800">{editing ? "Edit product" : "Add product"}</h2>
        {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Price (₹)</label>
            <input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <label className="label">Stock</label>
            <input className="input" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
          <div>
            <label className="label">Medium</label>
            <select className="input" value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })}>
              {mediums.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">None</option>
              {categories?.items?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="label">Product images</label>

          {existingImages.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-stone-500">Saved images ({existingImages.length})</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {existingImages.map((im, i) => (
                  <img key={im.id ?? i} src={im.url} alt="" className="h-16 w-16 rounded border border-stone-200 object-cover" />
                ))}
              </div>
            </div>
          )}

          <input
            key={fileInputKey}
            type="file"
            accept="image/*"
            multiple
            className={fileInputClass}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
          />

          {files.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-stone-600">{files.length} new file(s) to upload on save</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name || `New image ${i + 1}`}
                      className="h-16 w-16 rounded border border-brand-200 object-cover"
                    />
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                      onClick={() => removePendingFile(i)}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-stone-400">Or paste image URLs (one per line)</summary>
            <textarea
              className="input mt-2 font-mono text-xs"
              rows={3}
              placeholder={"https://images.example.com/painting-1.jpg\nhttps://images.example.com/painting-2.jpg"}
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
            />
          </details>

          <p className="mt-1 text-xs text-stone-400">
            Select multiple files at once, or add more in another pick. All selected images are saved when you click Create/Update.
          </p>
        </div>

        <div className="mt-4 flex gap-3">
          <button className="btn-primary px-6 py-2" disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Update" : "Create"}
          </button>
          {editing && <button type="button" className="btn-outline px-6 py-2" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div>
        <h2 className="font-semibold text-stone-800">All products ({products.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="py-2">Title</th>
                <th>Medium</th>
                <th>Price</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-stone-100">
                  <td className="py-2 font-medium text-stone-800">{p.title}</td>
                  <td className="capitalize text-stone-600">{p.medium}</td>
                  <td>{formatINR(p.price)}</td>
                  <td>{p.stock}</td>
                  <td className="space-x-3 text-right">
                    <button className="text-brand-700 hover:underline" onClick={() => startEdit(p)}>Edit</button>
                    <button className="text-red-500 hover:underline" onClick={() => del.mutate(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
