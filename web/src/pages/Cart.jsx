import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/hooks";
import { formatINR } from "../lib/format";
import { Spinner } from "../components/Spinner";
import { ArrowRightIcon, CartIcon, ShieldIcon } from "../components/icons";

export function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cart, isLoading } = useCart();

  const updateQty = useMutation({
    mutationFn: (v) => api.patch(`/v1/cart/items/${v.id}`, { quantity: v.quantity }),
    onSuccess: (data) => qc.setQueryData(["cart"], data),
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/v1/cart/items/${id}`),
    onSuccess: (data) => qc.setQueryData(["cart"], data),
  });

  if (!user) {
    return (
      <EmptyState
        title="Your cart awaits"
        text="Please sign in to view your cart and saved items."
        cta={<Link to="/login" state={{ from: "/cart" }} className="btn-primary mt-6 px-7 py-3">Sign in</Link>}
      />
    );
  }

  if (isLoading) return <Spinner />;

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        text="Discover handcrafted pieces and add your favourites here."
        cta={<Link to="/products" className="btn-primary mt-6 px-7 py-3">Browse the gallery <ArrowRightIcon size={17} /></Link>}
      />
    );
  }

  return (
    <div className="section py-10">
      <h1 className="font-display text-4xl font-black tracking-tight text-ink">Your cart</h1>
      <p className="mt-1 text-stone-500">{items.length} {items.length === 1 ? "item" : "items"} ready for checkout</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card flex items-center gap-4 p-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-2xl font-bold text-brand-600">
                {item.title.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.slug}`} className="font-display text-lg font-semibold text-ink transition hover:text-brand-700">
                  {item.title}
                </Link>
                <p className="text-sm text-stone-500">{formatINR(item.price)} each</p>
                <button
                  className="mt-1 text-xs font-medium text-red-500 transition hover:text-red-600 hover:underline"
                  onClick={() => remove.mutate(item.id)}
                >
                  Remove
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-white p-1">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-stone-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                  disabled={item.quantity <= 1}
                  onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity - 1 })}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-stone-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                  disabled={item.quantity >= item.stock}
                  onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity + 1 })}
                >
                  +
                </button>
              </div>
              <div className="w-24 text-right font-display text-lg font-bold text-ink">
                {formatINR(item.line_total_paise / 100)}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold text-ink">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{formatINR(cart?.total ?? 0)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Shipping</span>
                <span className="text-accent-600">Calculated at checkout</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-5">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-2xl font-bold text-ink">{formatINR(cart?.total ?? 0)}</span>
            </div>
            <button className="btn-primary mt-6 w-full py-3.5 text-base" onClick={() => navigate("/checkout")}>
              Proceed to Checkout
              <ArrowRightIcon size={18} />
            </button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-400">
              <ShieldIcon size={14} /> Secure, encrypted checkout
            </p>
          </div>
          <Link to="/products" className="mt-4 block text-center text-sm font-medium text-stone-500 transition hover:text-brand-700">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

function EmptyState({ title, text, cta }) {
  return (
    <div className="section flex flex-col items-center py-24 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-brand-500">
        <CartIcon size={34} />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-stone-500">{text}</p>
      {cta}
    </div>
  );
}
