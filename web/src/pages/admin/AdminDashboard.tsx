import { NavLink, Route, Routes } from "react-router-dom";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminProducts } from "./AdminProducts";
import { AdminCategories } from "./AdminCategories";
import { AdminOrders } from "./AdminOrders";

const tabs = [
  { to: "/admin", label: "Analytics", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/orders", label: "Orders" },
];

export function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-stone-900">Admin</h1>
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
            <Route index element={<AdminAnalytics />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="orders" element={<AdminOrders />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
