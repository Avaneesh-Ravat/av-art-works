import { Link } from "react-router-dom";
import { formatINR } from "../lib/format";
import { ArrowRightIcon } from "./icons";

const placeholder =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><rect width='100%' height='100%' fill='#f0c9ad'/><text x='50%' y='50%' font-family='Georgia' font-size='22' fill='#a84a20' text-anchor='middle' dominant-baseline='middle'>AV Art Works</text></svg>`,
  );

export function ProductCard({ product }) {
  const img = product.images?.[0]?.url || placeholder;
  const inStock = product.stock > 0;

  return (
    <Link
      to={`/products/${product.slug}`}
      className="card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-brand-50">
        <img
          src={img}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          onError={(e) => (e.target.src = placeholder)}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {product.medium && (
          <span className="absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 backdrop-blur">
            {product.medium}
          </span>
        )}
        <span
          className={`badge absolute right-3 top-3 backdrop-blur ${
            inStock ? "bg-white/85 text-accent-700" : "bg-ink/80 text-white"
          }`}
        >
          {inStock ? "In stock" : "Sold out"}
        </span>

        <span className="absolute bottom-3 left-3 right-3 flex translate-y-3 items-center justify-between rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-ink opacity-0 shadow-lift transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          View artwork
          <ArrowRightIcon size={16} className="text-brand-600" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 font-display text-lg font-semibold text-ink transition-colors group-hover:text-brand-700">
          {product.title}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold text-ink">{formatINR(product.price)}</span>
          {inStock ? (
            <span className="text-xs font-medium text-accent-600">Ready to ship</span>
          ) : (
            <span className="text-xs font-medium text-stone-400">Unavailable</span>
          )}
        </div>
      </div>
    </Link>
  );
}
