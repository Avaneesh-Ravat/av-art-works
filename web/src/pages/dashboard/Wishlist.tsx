import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { WishlistItem } from "../../types";
import { formatINR } from "../../lib/format";
import { Spinner } from "../../components/Spinner";

export function Wishlist() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<{ items: WishlistItem[] }>("/v1/wishlist"),
  });
  const remove = useMutation({
    mutationFn: (productId: string) => api.del(`/v1/wishlist/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  if (isLoading) return <Spinner />;
  const items = data?.items ?? [];

  return (
    <div>
      <h2 className="font-semibold text-stone-800">Your wishlist</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-stone-500">Your wishlist is empty.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((w) => (
            <div key={w.product_id} className="card flex items-center justify-between p-4">
              <Link to={`/products/${w.slug}`} className="font-medium text-stone-800 hover:text-brand-700">
                {w.title}
              </Link>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{formatINR(w.price)}</span>
                <button className="text-sm text-red-500 hover:underline" onClick={() => remove.mutate(w.product_id)}>
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
