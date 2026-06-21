import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/hooks";
import { formatINR } from "../lib/format";
import { Spinner } from "../components/Spinner";

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
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-stone-900">Your cart</h1>
        <p className="mt-3 text-stone-500">Please sign in to view your cart.</p>
        <Link to="/login" state={{ from: "/cart" }} className="btn-primary mt-6 px-6 py-3">Sign in</Link>
      </div>
    );
  }

  if (isLoading) return <Spinner />;

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-stone-900">Your cart is empty</h1>
        <Link to="/products" className="btn-primary mt-6 px-6 py-3">Browse the gallery</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-stone-900">Your cart</h1>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="card flex items-center gap-4 p-4">
            <div className="flex-1">
              <Link to={`/products/${item.slug}`} className="font-medium text-stone-800 hover:text-brand-700">
                {item.title}
              </Link>
              <p className="text-sm text-stone-500">{formatINR(item.price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-outline h-8 w-8 p-0" disabled={item.quantity <= 1}
                onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity - 1 })}>−</button>
              <span className="w-8 text-center">{item.quantity}</span>
              <button className="btn-outline h-8 w-8 p-0" disabled={item.quantity >= item.stock}
                onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity + 1 })}>+</button>
            </div>
            <div className="w-24 text-right font-semibold">{formatINR(item.line_total_paise / 100)}</div>
            <button className="text-sm text-red-500 hover:underline" onClick={() => remove.mutate(item.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="card mt-6 flex items-center justify-between p-6">
        <span className="text-lg">Total</span>
        <span className="font-display text-2xl font-bold text-stone-900">{formatINR(cart?.total ?? 0)}</span>
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn-primary px-8 py-3" onClick={() => navigate("/checkout")}>Proceed to Checkout</button>
      </div>
    </div>
  );
}
