import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Profile } from "./dashboard/Profile";
import { Orders } from "./dashboard/Orders";
import { Addresses } from "./dashboard/Addresses";
import { Wishlist } from "./dashboard/Wishlist";
import { HeartIcon, MapPinIcon, PackageIcon, UserIcon } from "../components/icons";

const tabs = [
  { to: "/dashboard", label: "Profile", end: true, Icon: UserIcon },
  { to: "/dashboard/orders", label: "Orders", Icon: PackageIcon },
  { to: "/dashboard/addresses", label: "Addresses", Icon: MapPinIcon },
  { to: "/dashboard/wishlist", label: "Wishlist", Icon: HeartIcon },
];

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="section py-10">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 font-display text-xl font-bold text-white shadow-soft">
          {user?.full_name?.charAt(0) ?? "A"}
        </span>
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink">
            Hi, {user?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-sm text-stone-500">Manage your profile, orders and saved items.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[230px_1fr]">
        <nav className="card flex gap-1 overflow-x-auto p-2 md:h-fit md:flex-col">
          {tabs.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand-600 text-white shadow-soft"
                    : "text-stone-600 hover:bg-brand-50 hover:text-brand-700"
                }`
              }
            >
              <Icon size={18} />
              {label}
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
