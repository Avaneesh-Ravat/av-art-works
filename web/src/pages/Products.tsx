import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Category, Page, Product } from "../types";
import { ProductCard } from "../components/ProductCard";
import { Spinner } from "../components/Spinner";

const sorts = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "title", label: "Title A–Z" },
];

export function Products() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page") ?? "1");
  const limit = 12;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ items: Category[] }>("/v1/categories"),
  });

  const query = new URLSearchParams({ sort, page: String(page), limit: String(limit) });
  if (q) query.set("q", q);
  if (category) query.set("category", category);

  const { data, isLoading } = useQuery({
    queryKey: ["products", q, category, sort, page],
    queryFn: () => api.get<Page<Product>>(`/v1/products?${query.toString()}`),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-stone-900">Gallery</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search artworks…"
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
          }}
        />
        <select className="input sm:max-w-[200px]" value={category} onChange={(e) => setParam("category", e.target.value)}>
          <option value="">All categories</option>
          {categories?.items?.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select className="input sm:max-w-[200px]" value={sort} onChange={(e) => setParam("sort", e.target.value)}>
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data && data.items?.length ? (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button className="btn-outline" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                Previous
              </button>
              <span className="text-sm text-stone-600">Page {page} of {totalPages}</span>
              <button className="btn-outline" disabled={page >= totalPages} onClick={() => setParam("page", String(page + 1))}>
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="py-16 text-center text-stone-500">No artworks found. Try a different search or category.</p>
      )}
    </div>
  );
}
