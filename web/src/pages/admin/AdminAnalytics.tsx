import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Order } from "../../types";
import { formatINR } from "../../lib/format";
import { Spinner } from "../../components/Spinner";

export function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => api.get<{ items: Order[] }>("/v1/admin/orders?limit=200"),
  });

  if (isLoading) return <Spinner />;
  const orders = data?.items ?? [];
  const paid = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);

  const now = new Date();
  const monthRevenue = paid
    .filter((o) => {
      const d = new Date(o.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, o) => sum + o.total, 0);

  const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const cards = [
    { label: "Total Orders", value: String(orders.length) },
    { label: "Paid Orders", value: String(paid.length) },
    { label: "Total Revenue", value: formatINR(revenue) },
    { label: "This Month", value: formatINR(monthRevenue) },
  ];

  return (
    <div>
      <h2 className="font-semibold text-stone-800">Sales overview</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm text-stone-500">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-stone-900">{c.value}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-semibold text-stone-800">Orders by status</h3>
      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="card px-4 py-3">
            <span className="text-sm capitalize text-stone-600">{status}</span>
            <span className="ml-2 font-semibold text-stone-900">{count}</span>
          </div>
        ))}
        {orders.length === 0 && <p className="text-stone-500">No orders yet.</p>}
      </div>
    </div>
  );
}
