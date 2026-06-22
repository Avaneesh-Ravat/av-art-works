import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { Spinner } from "../../components/Spinner";

export function Wishlist() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get("/v1/wishlist"),
  });
  const remove = useMutation({
    mutationFn: (productId) => api.del(`/v1/wishlist/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  if (isLoading) return <Spinner />;
  const items = data?.items ?? [];

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink">Your wishlist</h2>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 py-14 text-center text-stone-500">
          Your wishlist is empty.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((w) => (
            <div key={w.product_id} className="card flex items-center gap-4 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-lg font-bold text-brand-600">
                {w.title.charAt(0)}
              </span>
              <Link to={`/products/${w.slug}`} className="flex-1 font-display text-lg font-semibold text-ink transition hover:text-brand-700">
                {w.title}
              </Link>
              <div className="flex items-center gap-4">
                <span className="font-semibold text-ink">{formatINR(w.price)}</span>
                <button className="text-sm font-medium text-red-500 transition hover:text-red-600 hover:underline" onClick={() => remove.mutate(w.product_id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
