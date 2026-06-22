import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useCart } from "../lib/hooks";
import { formatINR } from "../lib/format";
import { Spinner } from "../components/Spinner";
import { MapPinIcon, ShieldIcon } from "../components/icons";

function sameAddress(a, b) {
  return (
    a.line1 === b.line1 &&
    (a.line2 ?? "") === (b.line2 ?? "") &&
    a.city === b.city &&
    (a.state ?? "") === (b.state ?? "") &&
    a.pincode === b.pincode
  );
}

async function saveAddressIfNew(addr, savedItems) {
  if (savedItems?.some((a) => sameAddress(a, addr))) return;
  await api.post("/v1/users/me/addresses", {
    line1: addr.line1,
    line2: addr.line2 ?? "",
    city: addr.city,
    state: addr.state ?? "",
    pincode: addr.pincode,
    country: "India",
    is_default: !savedItems?.length,
  });
}

export function Checkout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cart, isLoading } = useCart();

  const { data: saved } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get("/v1/users/me/addresses"),
  });

  const [addr, setAddr] = useState({ line1: "", line2: "", city: "", state: "", pincode: "" });
  const [method, setMethod] = useState("razorpay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const applySaved = (a) =>
    setAddr({ line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state, pincode: a.pincode });

  const placeOrder = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const order = await api.post("/v1/orders", { shipping_address: { ...addr, country: "India" } });

      const pay = await api.post("/v1/payments", {
        order_id: order.id,
        method,
      });

      if (method === "razorpay") {
        const sim = await api.post(`/v1/payments/${pay.payment.id}/simulate`);
        await api.post(`/v1/payments/verify`, {
          payment_id: pay.payment.id,
          razorpay_payment_id: sim.razorpay_payment_id,
          razorpay_signature: sim.razorpay_signature,
        });
      }

      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      try {
        await saveAddressIfNew(addr, saved?.items);
        qc.invalidateQueries({ queryKey: ["addresses"] });
      } catch {
        // Order succeeded; address save is best-effort.
      }
      navigate(`/dashboard/orders?placed=${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Spinner />;
  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="section py-24 text-center">
        <p className="font-display text-2xl font-bold text-ink">Your cart is empty</p>
        <Link to="/products" className="btn-primary mt-6 px-6 py-3">Browse the gallery</Link>
      </div>
    );
  }

  return (
    <div className="section py-10">
      <Link to="/cart" className="text-sm font-medium text-stone-500 transition hover:text-brand-700">← Back to cart</Link>
      <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-ink">Checkout</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={placeOrder} className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">1</span>
              <h2 className="font-display text-xl font-bold text-ink">Shipping address</h2>
            </div>

            {saved?.items?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">Saved addresses</p>
                <div className="flex flex-wrap gap-2">
                  {saved.items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      onClick={() => applySaved(a)}
                    >
                      <MapPinIcon size={14} />
                      {a.line1}, {a.city}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Address line 1</label>
                <input className="input" required value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address line 2</label>
                <input className="input" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" required value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" required value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input className="input" required value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">2</span>
              <h2 className="font-display text-xl font-bold text-ink">Payment method</h2>
            </div>
            <div className="mt-4 space-y-3">
              <PaymentOption
                checked={method === "razorpay"}
                onChange={() => setMethod("razorpay")}
                title="Pay online (Razorpay)"
                note="Mock gateway in this demo"
              />
              <PaymentOption
                checked={method === "cod"}
                onChange={() => setMethod("cod")}
                title="Cash on Delivery"
                note="Pay when your artwork arrives"
              />
            </div>
          </section>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
          <button className="btn-primary w-full py-3.5 text-base sm:w-auto sm:px-10" disabled={busy}>
            {busy ? "Placing order…" : `Place order · ${formatINR(cart?.total ?? 0)}`}
          </button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold text-ink">Order summary</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="text-stone-600">{i.title} <span className="text-stone-400">× {i.quantity}</span></span>
                  <span className="shrink-0 font-medium text-ink">{formatINR(i.line_total_paise / 100)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-between border-t border-stone-200 pt-5">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-2xl font-bold text-ink">{formatINR(cart?.total ?? 0)}</span>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-400">
              <ShieldIcon size={14} /> Secure, encrypted checkout
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PaymentOption({ checked, onChange, title, note }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition ${
        checked ? "border-brand-500 bg-brand-50/60" : "border-stone-200 hover:border-brand-200"
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="h-4 w-4 accent-brand-600" />
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-xs text-stone-400">{note}</span>
      </span>
    </label>
  );
}
