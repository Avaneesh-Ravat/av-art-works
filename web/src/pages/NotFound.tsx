import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-brand-300">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-stone-900">Page not found</h1>
      <p className="mt-2 text-stone-500">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="btn-primary mt-6 px-6 py-3">Back home</Link>
    </div>
  );
}
