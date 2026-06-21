import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useCart } from "../lib/hooks";
import { formatINR } from "../lib/format";
import { Spinner } from "../components/Spinner";

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
      // 1. Create the order from the cart.
      const order = await api.post("/v1/orders", { shipping_address: addr });

      // 2. Initiate payment.
      const pay = await api.post("/v1/payments", {
        order_id: order.id,
        method,
      });

      // 3. For the online (mock Razorpay) flow, simulate the checkout widget
      //    then verify. A real integration would open the Razorpay modal here.
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
    return <p className="py-20 text-center text-stone-500">Your cart is empty.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-stone-900">Checkout</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-3">
        <form onSubmit={placeOrder} className="md:col-span-2 space-y-6">
          <section className="card p-6">
            <h2 className="font-semibold text-stone-800">Shipping address</h2>
            {saved?.items?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {saved.items.map((a) => (
                  <button key={a.id} type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => applySaved(a)}>
                    {a.line1}, {a.city}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                <input className="input" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input className="input" required value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold text-stone-800">Payment method</h2>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} />
                <span>Pay online (Razorpay) <span className="text-xs text-stone-400">— mock gateway in this demo</span></span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={method === "cod"} onChange={() => setMethod("cod")} />
                <span>Cash on Delivery</span>
              </label>
            </div>
          </section>

          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button className="btn-primary px-8 py-3" disabled={busy}>
            {busy ? "Placing order…" : `Place order · ${formatINR(cart?.total ?? 0)}`}
          </button>
        </form>

        <aside className="card h-fit p-6">
          <h2 className="font-semibold text-stone-800">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span className="text-stone-600">{i.title} × {i.quantity}</span>
                <span>{formatINR(i.line_total_paise / 100)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 font-semibold">
            <span>Total</span>
            <span>{formatINR(cart?.total ?? 0)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
