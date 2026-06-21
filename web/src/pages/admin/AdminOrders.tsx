import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Order } from "../../types";
import { formatINR, formatDate } from "../../lib/format";
import { Spinner } from "../../components/Spinner";

const statuses = ["pending", "paid", "shipped", "delivered", "cancelled", "refunded"];

export function AdminOrders() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => api.get<{ items: Order[] }>("/v1/admin/orders?limit=200"),
  });

  const updateStatus = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      api.patch(`/v1/admin/orders/${v.id}/status`, { status: v.status }),
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="py-2">Order</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-stone-100">
                  <td className="py-2 font-medium text-stone-800">#{o.id.slice(0, 8)}</td>
                  <td className="text-stone-600">{formatDate(o.created_at)}</td>
                  <td>{formatINR(o.total)}</td>
                  <td>
                    <select
                      className="input max-w-[150px] py-1"
                      value={o.status}
                      onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value })}
                    >
                      {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
