import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAddToCart } from "../lib/hooks";
import { formatINR } from "../lib/format";
import { Spinner } from "../components/Spinner";

const placeholder =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='450'><rect width='100%' height='100%' fill='#e7e5e4'/><text x='50%' y='50%' font-family='Georgia' font-size='28' fill='#a8a29e' text-anchor='middle' dominant-baseline='middle'>AV Art Works</text></svg>`,
  );

export function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const addToCart = useAddToCart();
  const [msg, setMsg] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api.get(`/v1/products/${slug}`),
    enabled: !!slug,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [slug, product?.id]);

  const wishlist = useMutation({
    mutationFn: (productId) => api.post("/v1/wishlist", { product_id: productId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      setMsg("Added to your wishlist.");
    },
  });

  if (isLoading) return <Spinner />;
  if (!product) return <p className="py-20 text-center text-stone-500">Artwork not found.</p>;

  const images = product.images?.filter((im) => im.url) ?? [];
  const activeImage = images[activeIndex]?.url || images[0]?.url || placeholder;
  const showThumbnails = images.length > 1;

  const requireAuth = () => {
    if (!user) {
      navigate("/login", { state: { from: `/products/${slug}` } });
      return false;
    }
    return true;
  };

  const handleAdd = async (then) => {
    if (!requireAuth()) return;
    try {
      await addToCart.mutateAsync({ product_id: product.id, quantity: 1 });
      setMsg("Added to cart.");
      then?.();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not add to cart.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/products" className="text-sm text-brand-700 hover:underline">← Back to gallery</Link>
      <div className="mt-4 grid gap-10 md:grid-cols-2">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
            <img
              src={activeImage}
              alt={product.title}
              className="h-full w-full object-cover"
              onError={(e) => (e.target.src = placeholder)}
            />
          </div>
          {showThumbnails && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {images.map((im, i) => (
                <button
                  key={im.id ?? i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    i === activeIndex ? "border-brand-600 ring-1 ring-brand-600" : "border-transparent hover:border-stone-300"
                  }`}
                >
                  <img
                    src={im.url}
                    alt={`${product.title} view ${i + 1}`}
                    className="aspect-square w-full object-cover"
                    onError={(e) => (e.target.src = placeholder)}
                  />
                </button>
              ))}
            </div>
          )}
          {showThumbnails && (
            <p className="mt-2 text-center text-xs text-stone-500">
              {activeIndex + 1} of {images.length} photos
            </p>
          )}
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest text-brand-600">{product.medium}</span>
          <h1 className="mt-1 font-display text-3xl font-bold text-stone-900">{product.title}</h1>
          <p className="mt-4 text-2xl font-semibold text-stone-900">{formatINR(product.price)}</p>
          <p className="mt-1 text-sm">
            {product.stock > 0 ? (
              <span className="text-green-600">In stock ({product.stock} available)</span>
            ) : (
              <span className="text-red-500">Sold out</span>
            )}
          </p>
          <p className="mt-6 whitespace-pre-line text-stone-600">{product.description}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn-primary px-6 py-3" disabled={product.stock <= 0 || addToCart.isPending}
              onClick={() => handleAdd()}>
              Add to Cart
            </button>
            <button className="btn-primary bg-stone-800 px-6 py-3 hover:bg-stone-900"
              disabled={product.stock <= 0 || addToCart.isPending}
              onClick={() => handleAdd(() => navigate("/cart"))}>
              Buy Now
            </button>
            <button className="btn-outline px-6 py-3"
              onClick={() => requireAuth() && wishlist.mutate(product.id)}>
              ♥ Wishlist
            </button>
          </div>
          {msg && <p className="mt-4 text-sm text-brand-700">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
