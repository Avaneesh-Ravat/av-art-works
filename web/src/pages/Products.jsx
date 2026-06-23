import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ProductCard } from "../components/ProductCard";
import { ProductCardSkeleton } from "../components/Spinner";
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon } from "../components/icons";

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

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/v1/categories"),
  });

  const query = new URLSearchParams({ sort, page: String(page), limit: String(limit) });
  if (q) query.set("q", q);
  if (category) query.set("category", category);

  const { data, isLoading } = useQuery({
    queryKey: ["products", q, category, sort, page],
    queryFn: () => api.get(`/v1/products?${query.toString()}`),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div>
      {/* Page header */}
      <section className="relative overflow-hidden border-b border-stone-200/80">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-60 w-60 rounded-full bg-accent-100/60 blur-3xl" />
        </div>
        <div className="section py-12 md:py-16">
          <span className="eyebrow">The collection</span>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-ink md:text-5xl">
            Gallery
          </h1>
          <p className="mt-3 max-w-lg text-stone-600">
            Browse original handcrafted artworks. Filter by medium and find a piece that speaks to you.
          </p>
        </div>
      </section>

      <div className="section py-8">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              className="input pl-10"
              placeholder="Search artworks…"
              defaultValue={q}
              onKeyDown={(e) => {
                if (e.key === "Enter") setParam("q", e.target.value);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-stone-500">Sort by</label>
            <select
              className="input w-auto cursor-pointer"
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category chips */}
        {categories?.items?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className={`chip ${category === "" ? "chip-active" : ""}`}
              onClick={() => setParam("category", "")}
            >
              All categories
            </button>
            {categories.items.map((c) => (
              <button
                key={c.id}
                className={`chip ${category === c.slug ? "chip-active" : ""}`}
                onClick={() => setParam("category", c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : data && data.items?.length ? (
          <>
            <p className="mt-6 text-sm text-stone-500">
              Showing <span className="font-semibold text-ink">{data.items.length}</span> of {data.total} artworks
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-3">
                <button
                  className="btn-outline px-4"
                  disabled={page <= 1}
                  onClick={() => setParam("page", String(page - 1))}
                >
                  <ArrowLeftIcon size={16} />
                  Previous
                </button>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-soft">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn-outline px-4"
                  disabled={page >= totalPages}
                  onClick={() => setParam("page", String(page + 1))}
                >
                  Next
                  <ArrowRightIcon size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-stone-300 py-20 text-center">
            <p className="font-display text-xl font-semibold text-ink">No artworks found</p>
            <p className="mt-2 text-stone-500">Try a different search or category.</p>
            <button className="btn-outline mt-6" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
