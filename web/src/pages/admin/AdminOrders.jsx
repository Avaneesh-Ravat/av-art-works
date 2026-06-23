import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatINR, formatDate } from "../../lib/format";
import { statusColor, orderTitle, itemCount } from "../../lib/orderStatus";
import { Spinner } from "../../components/Spinner";
import { ArrowRightIcon } from "../../components/icons";

const statuses = ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"];

export function AdminOrders() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => api.get("/v1/admin/orders?limit=200"),
  });

  const updateStatus = useMutation({
    mutationFn: (v) => api.patch(`/v1/admin/orders/${v.id}/status`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "orders"] }),
  });

  if (isLoading) return <Spinner />;
  const orders = data?.items ?? [];

  return (
    <div>
      <h2 className="font-semibold text-stone-800">All orders ({orders.length})</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-stone-500">No orders yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {orders.map((o) => {
            const count = itemCount(o);
            return (
              <div key={o.id} className="card flex flex-wrap items-center gap-4 p-4">
                <Link
                  to={`/admin/orders/${o.id}`}
                  className="group min-w-0 flex-1"
                >
                  <p className="truncate font-display text-lg font-semibold text-stone-900 transition group-hover:text-brand-700">
                    {orderTitle(o)}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    #{o.id.slice(0, 8).toUpperCase()} · {formatDate(o.created_at)} · {count}{" "}
                    {count === 1 ? "item" : "items"}
                  </p>
                </Link>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-stone-900">{formatINR(o.total)}</p>
                  <span className={`badge mt-1 capitalize ${statusColor[o.status] ?? "bg-stone-100 text-stone-600"}`}>
                    {o.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="input max-w-[150px] py-1"
                    value={o.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value })}
                  >
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <Link
                    to={`/admin/orders/${o.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition hover:text-brand-800"
                  >
                    View
                    <ArrowRightIcon size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
