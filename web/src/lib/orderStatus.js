// Shared order status styling + helpers.

export const statusColor = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-stone-200 text-stone-600",
  refunded: "bg-red-100 text-red-700",
};

export function orderTitle(order) {
  const items = order?.items ?? [];
  if (items.length === 0) return "Order";
  const first = items[0].title;
  if (items.length === 1) return first;
  return `${first} + ${items.length - 1} more`;
}

export function itemCount(order) {
  return (order?.items ?? []).reduce((n, i) => n + i.quantity, 0);
}
