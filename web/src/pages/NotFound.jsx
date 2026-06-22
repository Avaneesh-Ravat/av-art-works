import { Link } from "react-router-dom";
import { ArrowRightIcon, FrameIcon } from "../components/icons";

export function NotFound() {
  return (
    <div className="section flex flex-col items-center py-28 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-brand-500">
        <FrameIcon size={36} />
      </span>
      <p className="mt-8 font-display text-7xl font-black text-brand-300">404</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">This canvas is blank</h1>
      <p className="mt-2 max-w-sm text-stone-500">
        The page you’re looking for doesn’t exist or may have been moved.
      </p>
      <div className="mt-7 flex gap-3">
        <Link to="/" className="btn-primary px-6 py-3">Back home</Link>
        <Link to="/products" className="btn-outline px-6 py-3">
          Browse gallery <ArrowRightIcon size={16} />
        </Link>
      </div>
    </div>
  );
}
