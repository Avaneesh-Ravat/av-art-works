import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAddToCart } from "../lib/hooks";
import { formatINR } from "../lib/format";
import { Spinner } from "../components/Spinner";
import {
  ArrowLeftIcon,
  CartIcon,
  CheckIcon,
  HeartIcon,
  ShieldIcon,
  SparkleIcon,
  TruckIcon,
} from "../components/icons";

const placeholder =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><rect width='100%' height='100%' fill='#f0c9ad'/><text x='50%' y='50%' font-family='Georgia' font-size='28' fill='#a84a20' text-anchor='middle' dominant-baseline='middle'>AV Art Works</text></svg>`,
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
  if (!product)
    return (
      <div className="section py-24 text-center">
        <p className="font-display text-2xl font-bold text-ink">Artwork not found</p>
        <Link to="/products" className="btn-primary mt-6 px-6 py-3">Back to gallery</Link>
      </div>
    );

  const images = product.images?.filter((im) => im.url) ?? [];
  const activeImage = images[activeIndex]?.url || images[0]?.url || placeholder;
  const showThumbnails = images.length > 1;
  const inStock = product.stock > 0;

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
    <div className="section py-8 md:py-12">
      <nav className="flex items-center gap-1.5 text-sm text-stone-500">
        <Link to="/" className="transition hover:text-brand-700">Home</Link>
        <span>/</span>
        <Link to="/products" className="transition hover:text-brand-700">Gallery</Link>
        <span>/</span>
        <span className="truncate text-ink">{product.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-stone-200/80 bg-brand-50 shadow-soft">
            <img
              src={activeImage}
              alt={product.title}
              className="aspect-square w-full object-cover"
              onError={(e) => (e.target.src = placeholder)}
            />
          </div>
          {showThumbnails && (
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {images.map((im, i) => (
                <button
                  key={im.id ?? i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`overflow-hidden rounded-xl border-2 transition ${
                    i === activeIndex
                      ? "border-brand-600 shadow-soft"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  <img
                    src={im.url}
                    alt={`${product.title} view ${i + 1}`}
                    className="aspect-square w-full bg-brand-50 object-cover"
                    onError={(e) => (e.target.src = placeholder)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.medium && <span className="pill-muted">{product.medium}</span>}
          <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-ink">
            {product.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-display text-3xl font-bold text-ink">{formatINR(product.price)}</p>
            {inStock ? (
              <span className="badge bg-accent-100 text-accent-700">
                <CheckIcon size={13} /> In stock · {product.stock} available
              </span>
            ) : (
              <span className="badge bg-stone-200 text-stone-600">Sold out</span>
            )}
          </div>

          {product.description && (
            <p className="mt-6 whitespace-pre-line leading-relaxed text-stone-600">
              {product.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="btn-primary flex-1 px-6 py-3.5 text-base sm:flex-none"
              disabled={!inStock || addToCart.isPending}
              onClick={() => handleAdd()}
            >
              <CartIcon size={18} />
              Add to Cart
            </button>
            <button
              className="btn-dark flex-1 px-6 py-3.5 text-base sm:flex-none"
              disabled={!inStock || addToCart.isPending}
              onClick={() => handleAdd(() => navigate("/cart"))}
            >
              Buy Now
            </button>
            <button
              className="btn-outline px-5 py-3.5"
              onClick={() => requireAuth() && wishlist.mutate(product.id)}
            >
              <HeartIcon size={18} />
              <span className="hidden sm:inline">Wishlist</span>
            </button>
          </div>

          {msg && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700">
              <CheckIcon size={16} />
              {msg}
            </div>
          )}

          {/* Trust badges */}
          <div className="mt-8 grid gap-3 rounded-2xl border border-stone-200/80 bg-white/70 p-5 sm:grid-cols-3">
            <Trust Icon={SparkleIcon} title="Handmade" text="One-of-a-kind original" />
            <Trust Icon={TruckIcon} title="Shipped safely" text="Across India" />
            <Trust Icon={ShieldIcon} title="Secure checkout" text="Protected payment" />
          </div>

          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-stone-500 transition hover:text-brand-700"
          >
            <ArrowLeftIcon size={16} />
            Back to gallery
          </Link>
        </div>
      </div>
    </div>
  );
}

function Trust({ Icon, title, text }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-stone-500">{text}</p>
      </div>
    </div>
  );
}
