import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatINR, formatDate } from "../../lib/format";
import { orderTitle, itemCount } from "../../lib/orderStatus";
import { OrderReceipt } from "../../components/OrderReceipt";
import { Spinner } from "../../components/Spinner";
import { ArrowLeftIcon } from "../../components/icons";

const statuses = ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"];

export function AdminOrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => api.get(`/v1/admin/orders/${id}`),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: (status) => api.patch(`/v1/admin/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });

  if (isLoading) return <Spinner />;
  if (isError || !order) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 py-16 text-center">
        <p className="font-display text-xl font-semibold text-stone-800">Order not found</p>
        <Link to="/admin/orders" className="btn-outline mt-5">Back to orders</Link>
      </div>
    );
  }

  const count = itemCount(order);

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition hover:text-brand-700"
        >
          <ArrowLeftIcon size={16} />
          Back to orders
        </Link>
        <button className="btn-primary px-5 py-2.5" onClick={() => window.print()}>
          Print receipt
        </button>
      </div>

      <div className="no-print mt-4 card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900">{orderTitle(order)}</h2>
            <p className="mt-1 text-sm text-stone-500">
              #{order.id.slice(0, 8).toUpperCase()} · {formatDate(order.created_at)} · {count}{" "}
              {count === 1 ? "item" : "items"} · {formatINR(order.total)}
            </p>
            <p className="mt-1 text-xs text-stone-400">Customer ID: {order.user_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-stone-600" htmlFor="admin-order-status">
              Status
            </label>
            <select
              id="admin-order-status"
              className="input max-w-[160px] py-1.5"
              value={order.status}
              disabled={updateStatus.isPending}
              onChange={(e) => updateStatus.mutate(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <OrderReceipt order={order} />
      </div>
    </div>
  );
}
