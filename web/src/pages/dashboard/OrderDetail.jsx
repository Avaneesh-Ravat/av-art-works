import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useSiteProfileContent } from "../../lib/hooks";
import { formatINR, formatDate } from "../../lib/format";
import { statusColor } from "../../lib/orderStatus";
import { whatsappLink, mailtoLink } from "../../lib/contact";
import { Spinner } from "../../components/Spinner";
import { ArrowLeftIcon, CheckIcon, MailIcon, WhatsappIcon } from "../../components/icons";

export function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const justPlaced = params.get("placed") === "1";
  const { profile } = useSiteProfileContent();
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get(`/v1/orders/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <Spinner />;
  if (isError || !order) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 py-16 text-center">
        <p className="font-display text-xl font-semibold text-ink">Order not found</p>
        <Link to="/dashboard/orders" className="btn-outline mt-5">Back to orders</Link>
      </div>
    );
  }

  const items = order.items ?? [];
  const addr = order.shipping_address ?? {};
  const subtotal = items.reduce((sum, i) => sum + (i.price_paise ?? i.price * 100) * i.quantity, 0) / 100;
  const shortId = order.id.slice(0, 8).toUpperCase();
  const isPending = order.status === "pending";

  const payMessage = `Hi ${profile.site_name}! I'd like to pay for my order #${shortId} (total ${formatINR(order.total)}). Please share the payment details.`;
  const waUrl = whatsappLink(profile.phone, payMessage);
  const mailUrl = mailtoLink(profile.email, `Payment for order #${shortId}`, payMessage);

  return (
    <div>
      {justPlaced && (
        <div className="no-print mb-5 flex items-start gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700">
          <CheckIcon size={18} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Order placed!</span> Your order{" "}
            <span className="font-semibold">#{shortId}</span> is reserved. Complete payment below to confirm it.
          </p>
        </div>
      )}

      {/* Payment instructions (not printed) */}
      {isPending && (
        <div className="no-print mb-5 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-soft">
          <div className="border-b border-brand-100 bg-brand-50/70 px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Complete your payment</h2>
            <p className="mt-1 text-sm text-stone-600">
              Your order is reserved. Message us and we’ll share UPI / bank details, then confirm &amp; ship your artwork.
            </p>
          </div>
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <span className="font-display text-2xl font-bold text-ink">{formatINR(order.total)}</span>
            <div className="flex flex-1 flex-wrap gap-3 sm:justify-end">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <WhatsappIcon size={18} />
                  Pay via WhatsApp
                </a>
              )}
              {mailUrl && (
                <a href={mailUrl} className="btn-outline px-5 py-2.5">
                  <MailIcon size={18} />
                  Email us
                </a>
              )}
            </div>
          </div>
          {!waUrl && !mailUrl && (
            <p className="px-5 pb-5 text-sm text-stone-500">
              Contact details aren’t set yet. Add a phone/email under Admin → Site profile.
            </p>
          )}
        </div>
      )}

      {/* Toolbar (not printed) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/dashboard/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition hover:text-brand-700"
        >
          <ArrowLeftIcon size={16} />
          Back to orders
        </Link>
        <button className="btn-primary px-5 py-2.5" onClick={() => window.print()}>
          Print / Download receipt
        </button>
      </div>

      {/* Receipt */}
      <div id="receipt" className="card mt-5 p-6 sm:p-8">
        {/* Header */}
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

        {/* Meta */}
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

        {/* Shipping address */}
        {(addr.line1 || addr.city) && (
          <div className="border-t border-stone-200 py-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Ship to</p>
            <div className="mt-2 text-sm leading-relaxed text-stone-700">
              {addr.line1 && <p>{addr.line1}</p>}
              {addr.line2 && <p>{addr.line2}</p>}
              {addr.locality && <p>{addr.locality}</p>}
              <p>
                {[addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
              </p>
              {addr.country && <p>{addr.country}</p>}
            </div>
          </div>
        )}

        {/* Items */}
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

          {/* Totals */}
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
