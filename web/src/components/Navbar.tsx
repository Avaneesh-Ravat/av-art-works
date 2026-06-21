import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/hooks";

export function Navbar() {
  const { user, logout } = useAuth();
  const { data: cart } = useCart();
  const navigate = useNavigate();
  const count = cart?.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition hover:text-brand-700 ${isActive ? "text-brand-700" : "text-stone-600"}`;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-display text-xl font-bold tracking-tight text-brand-700">
          AV Art Works
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className={linkCls} end>
            Home
          </NavLink>
          <NavLink to="/products" className={linkCls}>
            Gallery
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to="/admin" className={linkCls}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/cart" className="relative text-sm font-medium text-stone-600 hover:text-brand-700">
            Cart
            {count > 0 && (
              <span className="absolute -right-3 -top-2 rounded-full bg-brand-600 px-1.5 text-xs text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-sm font-medium text-stone-600 hover:text-brand-700">
                {user.full_name.split(" ")[0]}
              </Link>
              <button
                className="btn-outline px-3 py-1.5"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary px-3 py-1.5">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
