import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useSiteProfileContent } from "../../lib/hooks";
import { formatINR } from "../../lib/format";
import { whatsappLink, mailtoLink } from "../../lib/contact";
import { OrderReceipt } from "../../components/OrderReceipt";
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

      <div className="mt-5">
        <OrderReceipt order={order} />
      </div>
    </div>
  );
}
