import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/hooks";
import { CartIcon, CloseIcon, MenuIcon, UserIcon } from "./icons";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Gallery" },
  { to: "/#about", label: "About" },
  { to: "/#contact", label: "Contact" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const { data: cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const count = cart?.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  const linkCls = ({ isActive }) =>
    `relative text-sm font-medium transition-colors hover:text-brand-700 ${
      isActive ? "text-brand-700" : "text-stone-600"
    }`;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-stone-200/80 bg-cream/85 shadow-soft backdrop-blur-md"
          : "border-b border-transparent bg-cream/40 backdrop-blur"
      }`}
    >
      <div className="section flex items-center justify-between py-3.5">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white shadow-soft transition-transform group-hover:-rotate-6">
            AV
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-ink">
            Art Works
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) =>
            item.to.includes("#") ? (
              <Link key={item.label} to={item.to} className="text-sm font-medium text-stone-600 transition-colors hover:text-brand-700">
                {item.label}
              </Link>
            ) : (
              <NavLink key={item.label} to={item.to} end={item.end} className={linkCls}>
                {item.label}
              </NavLink>
            ),
          )}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={linkCls}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-brand-50 hover:text-brand-700"
          >
            <CartIcon size={21} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white shadow-soft">
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                <UserIcon size={17} />
                {user.full_name.split(" ")[0]}
              </Link>
              <button
                className="btn-ghost px-3 py-1.5"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary hidden px-5 py-2 sm:inline-flex">
              Sign in
            </Link>
          )}

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-stone-700 transition hover:bg-brand-50 md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden border-t border-stone-200/80 bg-cream/95 backdrop-blur-md transition-all duration-300 md:hidden ${
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="section flex flex-col gap-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link to="/admin" className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-brand-50 hover:text-brand-700">
              Admin
            </Link>
          )}
          <div className="mt-2 border-t border-stone-200/80 pt-3">
            {user ? (
              <div className="flex flex-col gap-2">
                <Link to="/dashboard" className="btn-outline w-full">My account</Link>
                <button
                  className="btn-ghost w-full"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary w-full">Sign in</Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
