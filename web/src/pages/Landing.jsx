import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSiteProfileContent } from "../lib/hooks";
import { ProductCard } from "../components/ProductCard";
import { ProductCardSkeleton } from "../components/Spinner";
import {
  ArrowRightIcon,
  BrushIcon,
  FrameIcon,
  PaletteIcon,
  ShieldIcon,
  SparkleIcon,
  StarIcon,
  TruckIcon,
} from "../components/icons";

const features = [
  { Icon: BrushIcon, title: "Handcrafted", text: "Every piece made by hand, never mass produced." },
  { Icon: PaletteIcon, title: "Custom commissions", text: "Order a piece tailored to your space." },
  { Icon: TruckIcon, title: "Pan-India shipping", text: "Carefully packed and delivered to your door." },
  { Icon: ShieldIcon, title: "Secure checkout", text: "Safe payments with order tracking." },
];

const categoryIcons = [PaletteIcon, BrushIcon, FrameIcon, SparkleIcon, ShieldIcon];

export function Landing() {
  const { profile } = useSiteProfileContent();
  const { data: featured, isLoading } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => api.get("/v1/products?limit=4&sort=newest"),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/v1/categories"),
  });

  const featuredItems = featured?.items?.filter((p) => p.images?.[0]?.url) ?? [];
  const heroImages = featuredItems.slice(0, 3).map((p) => p.images[0].url);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-accent-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl" />
        </div>

        <div className="section grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="pill-muted">
              <SparkleIcon size={14} />
              {profile.hero_tagline || "Handcrafted in India"}
            </span>
            <h1 className="mt-5 font-display text-5xl font-black leading-[1.05] tracking-tight text-ink text-balance md:text-6xl">
              {profile.hero_title}
            </h1>
            {profile.hero_description && (
              <p className="mt-5 max-w-md text-lg leading-relaxed text-stone-600">
                {profile.hero_description}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary px-7 py-3 text-base">
                Explore the Gallery
                <ArrowRightIcon size={18} />
              </Link>
              <a href="#about" className="btn-outline px-7 py-3 text-base">
                About the Artist
              </a>
            </div>

            <div className="mt-10 flex items-center gap-8">
              <div>
                <p className="font-display text-2xl font-bold text-ink">100%</p>
                <p className="text-sm text-stone-500">Handmade</p>
              </div>
              <div className="h-10 w-px bg-stone-200" />
              <div>
                <p className="font-display text-2xl font-bold text-ink">1 of 1</p>
                <p className="text-sm text-stone-500">Original pieces</p>
              </div>
              <div className="h-10 w-px bg-stone-200" />
              <div>
                <div className="flex text-brand-500">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <StarIcon key={i} size={16} filled />
                  ))}
                </div>
                <p className="mt-1 text-sm text-stone-500">Loved by collectors</p>
              </div>
            </div>
          </div>

          {/* Hero visual collage */}
          <div className="relative animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 pt-8">
                <HeroTile src={heroImages[0]} className="aspect-[3/4] animate-float" label={profile.site_name} />
                <HeroTile src={heroImages[1]} className="aspect-square animate-float-slow" label={profile.site_name} />
              </div>
              <div className="space-y-4">
                <HeroTile src={heroImages[2]} className="aspect-square animate-float-slow" label={profile.site_name} />
                <div className="card flex flex-col items-start gap-2 p-5 shadow-lift">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <PaletteIcon />
                  </span>
                  <p className="font-display text-lg font-bold text-ink">Custom art</p>
                  <p className="text-sm text-stone-500">Commission a piece made just for you.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="section">
        <div className="grid gap-4 rounded-3xl border border-stone-200/80 bg-white/70 p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl p-4 transition hover:bg-brand-50/60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Icon />
              </span>
              <div>
                <p className="font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-sm text-stone-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories?.items?.length > 0 && (
        <section className="section py-16">
          <div className="flex items-end justify-between">
            <div>
              <span className="eyebrow">Browse</span>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink">Shop by category</h2>
            </div>
            <Link to="/products" className="link-underline hidden text-sm sm:inline-flex">
              View all
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.items.map((c, i) => {
              const Icon = categoryIcons[i % categoryIcons.length];
              return (
                <Link
                  key={c.id}
                  to={`/products?category=${c.slug}`}
                  className="card-hover group flex flex-col items-center justify-center gap-3 p-6 text-center"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                    <Icon size={24} />
                  </span>
                  <span className="font-medium text-ink">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="section py-6">
        <div className="flex items-end justify-between">
          <div>
            <span className="eyebrow">Fresh off the easel</span>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">Featured artworks</h2>
          </div>
          <Link to="/products" className="link-underline text-sm">View all</Link>
        </div>
        {isLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : featuredItems.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredItems.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-stone-300 py-12 text-center text-stone-500">
            New pieces are on the way, check back soon.
          </p>
        )}
      </section>

      {/* About */}
      <section id="about" className="section scroll-mt-24 py-20">
        <div className="grid items-center gap-10 rounded-3xl border border-stone-200/80 bg-white/70 p-6 shadow-soft md:grid-cols-2 md:p-10">
          <div className="relative overflow-hidden rounded-2xl bg-brand-100">
            {profile.about_image_url ? (
              <img
                src={profile.about_image_url}
                alt={profile.about_title}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center font-display text-2xl text-brand-400">
                The Artist
              </div>
            )}
          </div>
          <div>
            <span className="eyebrow">Our story</span>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">{profile.about_title}</h2>
            <p className="mt-4 leading-relaxed text-stone-600">{profile.about_text}</p>
            <Link to="/products" className="btn-dark mt-7 px-6 py-3">
              See the collection
              <ArrowRightIcon size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {profile.testimonials.length > 0 && (
        <section className="section pb-8">
          <div className="text-center">
            <span className="eyebrow">Kind words</span>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">What collectors say</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {profile.testimonials.map((t) => (
              <figure key={`${t.name}-${t.text}`} className="card-hover flex flex-col p-6">
                <div className="flex text-brand-500">
                  {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} size={16} filled />)}
                </div>
                <blockquote className="mt-4 flex-1 leading-relaxed text-stone-600">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-display font-bold text-brand-700">
                    {t.name.charAt(0)}
                  </span>
                  <span className="font-semibold text-ink">{t.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function HeroTile({ src, className, label }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-brand-100 shadow-lift ${className}`}>
      {src ? (
        <img src={src} alt="Featured artwork" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-lg text-brand-400">
          {label}
        </div>
      )}
    </div>
  );
}
