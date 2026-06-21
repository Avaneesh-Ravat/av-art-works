import { NavLink, Route, Routes } from "react-router-dom";
import { Profile } from "./dashboard/Profile";
import { Orders } from "./dashboard/Orders";
import { Addresses } from "./dashboard/Addresses";
import { Wishlist } from "./dashboard/Wishlist";

const tabs = [
  { to: "/dashboard", label: "Profile", end: true },
  { to: "/dashboard/orders", label: "Orders" },
  { to: "/dashboard/addresses", label: "Addresses" },
  { to: "/dashboard/wishlist", label: "Wishlist" },
];

export function Dashboard() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-stone-900">My account</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-2 md:flex-col">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-100"}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Routes>
            <Route index element={<Profile />} />
            <Route path="orders" element={<Orders />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="wishlist" element={<Wishlist />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
