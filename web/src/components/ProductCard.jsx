import { Link } from "react-router-dom";
import { formatINR } from "../lib/format";

const placeholder =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='#e7e5e4'/><text x='50%' y='50%' font-family='Georgia' font-size='20' fill='#a8a29e' text-anchor='middle' dominant-baseline='middle'>AV Art Works</text></svg>`,
  );

export function ProductCard({ product }) {
  const img = product.images?.[0]?.url || placeholder;
  return (
    <Link to={`/products/${product.slug}`} className="card group overflow-hidden transition hover:shadow-md">
      <div className="aspect-[4/3] overflow-hidden bg-stone-100">
        <img
          src={img}
          alt={product.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          onError={(e) => (e.target.src = placeholder)}
        />
      </div>
      <div className="p-4">
        <span className="text-xs uppercase tracking-wide text-brand-600">{product.medium}</span>
        <h3 className="mt-1 line-clamp-1 font-medium text-stone-800">{product.title}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold text-stone-900">{formatINR(product.price)}</span>
          {product.stock > 0 ? (
            <span className="text-xs text-green-600">In stock</span>
          ) : (
            <span className="text-xs text-red-500">Sold out</span>
          )}
        </div>
      </div>
    </Link>
  );
}
