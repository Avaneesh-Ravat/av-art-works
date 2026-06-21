import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatINR, formatDate } from "../../lib/format";
import { Spinner } from "../../components/Spinner";

const statusColor = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-stone-200 text-stone-600",
  refunded: "bg-red-100 text-red-700",
};

export function Orders() {
  const [params] = useSearchParams();
  const placed = params.get("placed");
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.get("/v1/orders"),
  });

  if (isLoading) return <Spinner />;
  const orders = data?.items ?? [];

  return (
    <div>
      {placed && (
        <div className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">
          Order placed successfully! Your order id is {placed.slice(0, 8)}.
        </div>
      )}
      <h2 className="font-semibold text-stone-800">Order history</h2>
      {orders.length === 0 ? (
        <p className="mt-4 text-stone-500">You have no orders yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-800">#{o.id.slice(0, 8)}</p>
                  <p className="text-sm text-stone-500">{formatDate(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[o.status] ?? "bg-stone-100"}`}>
                    {o.status}
                  </span>
                  <p className="mt-1 font-semibold">{formatINR(o.total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
