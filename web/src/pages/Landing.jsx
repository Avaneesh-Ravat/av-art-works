import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSiteProfileContent } from "../lib/hooks";
import { ProductCard } from "../components/ProductCard";
import { Spinner } from "../components/Spinner";

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

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-stone-100">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-20 md:grid-cols-2">
          <div>
            {profile.hero_tagline && (
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{profile.hero_tagline}</p>
            )}
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-stone-900 md:text-5xl">
              {profile.hero_title}
            </h1>
            {profile.hero_description && (
              <p className="mt-4 text-lg text-stone-600">{profile.hero_description}</p>
            )}
            <div className="mt-6 flex gap-3">
              <Link to="/products" className="btn-primary px-6 py-3">Explore the Gallery</Link>
              <a href="#about" className="btn-outline px-6 py-3">About the Artist</a>
            </div>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-brand-100 shadow-lg">
            <div className="flex h-full w-full items-center justify-center font-display text-2xl text-brand-400">
              {profile.site_name}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-2xl font-bold text-stone-900">Shop by category</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories?.items?.map((c) => (
            <Link
              key={c.id}
              to={`/products?category=${c.slug}`}
              className="card flex flex-col items-center justify-center p-6 text-center transition hover:border-brand-300 hover:shadow-md"
            >
              <span className="font-medium text-stone-800">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-stone-900">Featured artworks</h2>
          <Link to="/products" className="text-sm font-medium text-brand-700 hover:underline">View all →</Link>
        </div>
        {isLoading ? (
          <Spinner />
        ) : featuredItems.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredItems.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="mt-6 py-8 text-center text-stone-500">Not available</p>
        )}
      </section>

      {/* About */}
      <section id="about" className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">
            {profile.about_image_url ? (
              <img
                src={profile.about_image_url}
                alt={profile.about_title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-xl text-stone-400">
                The Artist
              </div>
            )}
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-stone-900">{profile.about_title}</h2>
            <p className="mt-4 text-stone-600">{profile.about_text}</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {profile.testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center font-display text-2xl font-bold text-stone-900">What our customers say</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {profile.testimonials.map((t) => (
              <figure key={`${t.name}-${t.text}`} className="card p-6">
                <blockquote className="text-stone-600">“{t.text}”</blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-stone-800">— {t.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
