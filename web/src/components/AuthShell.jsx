import { Link } from "react-router-dom";
import { BrushIcon, PaletteIcon, SparkleIcon, TruckIcon } from "./icons";

const perks = [
  { Icon: PaletteIcon, text: "Save your favourite artworks" },
  { Icon: TruckIcon, text: "Track orders end to end" },
  { Icon: SparkleIcon, text: "Request custom commissions" },
];

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="section py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-soft md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-brand-600 p-10 text-white md:flex">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 right-0 h-48 w-48 rounded-full bg-accent-400/20 blur-2xl" />
          </div>
          <Link to="/" className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 font-display text-lg font-bold">
              AV
            </span>
            <span className="font-display text-xl font-bold">Art Works</span>
          </Link>
          <div className="relative">
            <BrushIcon size={36} className="text-brand-100" />
            <p className="mt-5 font-display text-3xl font-bold leading-tight">
              Art that brings your walls to life.
            </p>
            <ul className="mt-8 space-y-3.5">
              {perks.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-brand-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                    <Icon size={18} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-sm text-brand-100">Handcrafted with care in India.</p>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
