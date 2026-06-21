import { useSiteProfileContent } from "../lib/hooks";

const socialLinks = [
  { key: "instagram_url" as const, label: "Instagram" },
  { key: "facebook_url" as const, label: "Facebook" },
  { key: "pinterest_url" as const, label: "Pinterest" },
];

export function Footer() {
  const { profile } = useSiteProfileContent();
  const links = socialLinks.filter((s) => profile[s.key]?.trim());

  return (
    <footer id="contact" className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h3 className="font-display text-lg font-bold text-brand-700">{profile.site_name}</h3>
          {profile.footer_tagline && (
            <p className="mt-2 text-sm text-stone-500">{profile.footer_tagline}</p>
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-700">Contact</h4>
          <ul className="mt-2 space-y-1 text-sm text-stone-500">
            {profile.email && (
              <li>
                <a className="hover:text-brand-700" href={`mailto:${profile.email}`}>{profile.email}</a>
              </li>
            )}
            {profile.phone && <li>{profile.phone}</li>}
            {profile.location && <li>{profile.location}</li>}
          </ul>
        </div>
        {links.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-stone-700">Follow</h4>
            <ul className="mt-2 space-y-1 text-sm text-stone-500">
              {links.map((s) => (
                <li key={s.key}>
                  <a className="hover:text-brand-700" href={profile[s.key]} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </footer>
  );
}
