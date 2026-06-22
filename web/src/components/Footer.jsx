import { Link } from "react-router-dom";
import { useSiteProfileContent } from "../lib/hooks";
import {
  ArrowRightIcon,
  FacebookIcon,
  InstagramIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PinterestIcon,
} from "./icons";

const socialLinks = [
  { key: "instagram_url", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook_url", label: "Facebook", Icon: FacebookIcon },
  { key: "pinterest_url", label: "Pinterest", Icon: PinterestIcon },
];

export function Footer() {
  const { profile } = useSiteProfileContent();
  const links = socialLinks.filter((s) => profile[s.key]?.trim());

  return (
    <footer id="contact" className="mt-20 scroll-mt-24">
      {/* CTA band */}
      <div className="section">
        <div className="relative overflow-hidden rounded-3xl bg-brand-600 px-6 py-12 text-center shadow-lift sm:px-12">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-accent-400/20 blur-2xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Bring home a piece made by hand
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100">
              Original resin, texture and acrylic art — or commission something uniquely yours.
            </p>
            <Link
              to="/products"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              Explore the gallery
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-14 border-t border-stone-200 bg-white/60">
        <div className="section grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white">
                AV
              </span>
              <span className="font-display text-xl font-bold text-ink">Art Works</span>
            </div>
            {profile.footer_tagline && (
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-500">
                {profile.footer_tagline}
              </p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-ink">Explore</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-stone-500">
              <li><Link className="transition hover:text-brand-700" to="/products">Gallery</Link></li>
              <li><Link className="transition hover:text-brand-700" to="/#about">About the artist</Link></li>
              <li><Link className="transition hover:text-brand-700" to="/cart">Cart</Link></li>
              <li><Link className="transition hover:text-brand-700" to="/dashboard">My account</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-ink">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-stone-500">
              {profile.email && (
                <li>
                  <a className="flex items-center gap-2 transition hover:text-brand-700" href={`mailto:${profile.email}`}>
                    <MailIcon size={16} className="text-brand-500" />
                    {profile.email}
                  </a>
                </li>
              )}
              {profile.phone && (
                <li className="flex items-center gap-2">
                  <PhoneIcon size={16} className="text-brand-500" />
                  {profile.phone}
                </li>
              )}
              {profile.location && (
                <li className="flex items-center gap-2">
                  <MapPinIcon size={16} className="text-brand-500" />
                  {profile.location}
                </li>
              )}
            </ul>
          </div>

          {links.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-ink">Follow along</h4>
              <div className="mt-4 flex gap-3">
                {links.map(({ key, label, Icon }) => (
                  <a
                    key={key}
                    href={profile[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 hover:shadow-soft"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
