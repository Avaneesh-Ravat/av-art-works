import { formatINR, formatDate } from "../lib/format";
import { statusColor } from "../lib/orderStatus";

export function OrderReceipt({ order }) {
  const items = order.items ?? [];
  const addr = order.shipping_address ?? {};
  const subtotal = items.reduce((sum, i) => sum + (i.price_paise ?? i.price * 100) * i.quantity, 0) / 100;

  return (
    <div id="receipt" className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white">
            AV
          </span>
          <div>
            <p className="font-display text-xl font-bold text-ink">AV Art Works</p>
            <p className="text-sm text-stone-500">Handcrafted paintings &amp; artwork</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-ink">Receipt</p>
          <p className="mt-1 text-sm text-stone-500">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      <div className="grid gap-6 py-6 sm:grid-cols-3">
        <Meta label="Order date" value={formatDate(order.created_at)} />
        <Meta
          label="Status"
          value={
            <span className={`badge capitalize ${statusColor[order.status] ?? "bg-stone-100 text-stone-600"}`}>
              {order.status}
            </span>
          }
        />
        <Meta label="Order total" value={<span className="font-semibold text-ink">{formatINR(order.total)}</span>} />
      </div>

      {(addr.line1 || addr.city) && (
        <div className="border-t border-stone-200 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Ship to</p>
          <div className="mt-2 text-sm leading-relaxed text-stone-700">
            {addr.line1 && <p>{addr.line1}</p>}
            {addr.line2 && <p>{addr.line2}</p>}
            {addr.locality && <p>{addr.locality}</p>}
            <p>{[addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}</p>
            {addr.country && <p>{addr.country}</p>}
          </div>
        </div>
      )}

      <div className="border-t border-stone-200 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Items</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 px-3 text-center font-medium">Qty</th>
                <th className="py-2 px-3 text-right font-medium">Unit price</th>
                <th className="py-2 pl-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-stone-100">
                  <td className="py-3 pr-3 font-medium text-ink">{it.title}</td>
                  <td className="py-3 px-3 text-center text-stone-600">{it.quantity}</td>
                  <td className="py-3 px-3 text-right text-stone-600">{formatINR(it.price)}</td>
                  <td className="py-3 pl-3 text-right font-medium text-ink">{formatINR(it.price * it.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-xl font-bold text-ink">{formatINR(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 border-t border-stone-200 pt-6 text-center text-sm text-stone-400">
        Thank you for supporting handmade art. - AV Art Works
      </p>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p>
      <div className="mt-1.5 text-sm text-stone-700">{value}</div>
    </div>
  );
}
