import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatINR, formatDate } from "../../lib/format";
import { statusColor, orderTitle, itemCount } from "../../lib/orderStatus";
import { Spinner } from "../../components/Spinner";
import { ArrowRightIcon, PackageIcon } from "../../components/icons";

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
        <div className="mb-5 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700">
          🎉 Order placed successfully! Your order id is {placed.slice(0, 8)}.
        </div>
      )}
      <h2 className="font-display text-xl font-bold text-ink">Order history</h2>

      {orders.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 py-14 text-center">
          <PackageIcon size={32} className="mx-auto text-stone-300" />
          <p className="mt-3 text-stone-500">You have no orders yet.</p>
          <Link to="/products" className="btn-primary mt-5 px-6 py-2.5">Start shopping</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((o) => {
            const count = itemCount(o);
            return (
              <Link
                key={o.id}
                to={`/dashboard/orders/${o.id}`}
                className="card-hover group flex items-center gap-4 p-5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                  <PackageIcon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold text-ink transition group-hover:text-brand-700">
                    {orderTitle(o)}
                  </p>
                  <p className="text-sm text-stone-500">
                    {formatDate(o.created_at)} · {count} {count === 1 ? "item" : "items"} · #{o.id.slice(0, 8)}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <span className={`badge capitalize ${statusColor[o.status] ?? "bg-stone-100 text-stone-600"}`}>
                    {o.status}
                  </span>
                  <p className="mt-1.5 font-display text-lg font-bold text-ink">{formatINR(o.total)}</p>
                </div>
                <ArrowRightIcon size={18} className="shrink-0 text-stone-300 transition group-hover:translate-x-1 group-hover:text-brand-600" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
