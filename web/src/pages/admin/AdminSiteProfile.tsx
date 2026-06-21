import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useSiteProfile } from "../../lib/hooks";
import type { SiteProfile, SiteProfileInput, Testimonial } from "../../types";
import { Spinner } from "../../components/Spinner";

const emptyTestimonial = (): Testimonial => ({ name: "", text: "" });

function toForm(profile: SiteProfileInput): SiteProfileInput {
  return {
    site_name: profile.site_name,
    footer_tagline: profile.footer_tagline,
    hero_tagline: profile.hero_tagline,
    hero_title: profile.hero_title,
    hero_description: profile.hero_description,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    instagram_url: profile.instagram_url,
    facebook_url: profile.facebook_url,
    pinterest_url: profile.pinterest_url,
    testimonials: profile.testimonials.map((t) => ({ ...t })),
  };
}

export function AdminSiteProfile() {
  const qc = useQueryClient();
  const { data, isLoading } = useSiteProfile();
  const [form, setForm] = useState<SiteProfileInput | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (data && !form) {
      setForm(
        toForm({
          site_name: data.site_name,
          footer_tagline: data.footer_tagline,
          hero_tagline: data.hero_tagline,
          hero_title: data.hero_title,
          hero_description: data.hero_description,
          email: data.email,
          phone: data.phone,
          location: data.location,
          instagram_url: data.instagram_url,
          facebook_url: data.facebook_url,
          pinterest_url: data.pinterest_url,
          testimonials: data.testimonials.length ? data.testimonials : [emptyTestimonial()],
        }),
      );
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const payload: SiteProfileInput = {
        ...form,
        testimonials: form.testimonials.filter((t) => t.name.trim() || t.text.trim()),
      };
      return api.put<SiteProfile>("/v1/site-profile", payload);
    },
    onSuccess: (updated) => {
      if (!updated) return;
      qc.setQueryData(["site-profile"], updated);
      setForm(
        toForm({
          site_name: updated.site_name,
          footer_tagline: updated.footer_tagline,
          hero_tagline: updated.hero_tagline,
          hero_title: updated.hero_title,
          hero_description: updated.hero_description,
          email: updated.email,
          phone: updated.phone,
          location: updated.location,
          instagram_url: updated.instagram_url,
          facebook_url: updated.facebook_url,
          pinterest_url: updated.pinterest_url,
          testimonials: updated.testimonials.length ? updated.testimonials : [emptyTestimonial()],
        }),
      );
      setMsg("Site profile updated.");
      setError("");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  });

  if (isLoading || !form) return <Spinner />;

  const setTestimonial = (index: number, field: keyof Testimonial, value: string) => {
    setForm({
      ...form,
      testimonials: form.testimonials.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    });
  };

  const addTestimonial = () => {
    setForm({ ...form, testimonials: [...form.testimonials, emptyTestimonial()] });
  };

  const removeTestimonial = (index: number) => {
    setForm({
      ...form,
      testimonials: form.testimonials.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      <form
        className="card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          save.mutate();
        }}
      >
        <h2 className="font-semibold text-stone-800">Site profile</h2>
        <p className="mt-1 text-sm text-stone-500">
          Update the hero section, contact details, and social links. To edit the home page &ldquo;About the artist&rdquo; section, use the About artist tab.
        </p>
        {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {msg && <p className="mt-2 rounded bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</p>}

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-stone-700">Branding</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Site name</label>
                <input
                  className="input"
                  required
                  value={form.site_name}
                  onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Footer tagline</label>
                <input
                  className="input"
                  value={form.footer_tagline}
                  onChange={(e) => setForm({ ...form, footer_tagline: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-stone-700">Hero section</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Tagline</label>
                <input
                  className="input"
                  value={form.hero_tagline}
                  onChange={(e) => setForm({ ...form, hero_tagline: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Title</label>
                <input
                  className="input"
                  required
                  value={form.hero_title}
                  onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.hero_description}
                  onChange={(e) => setForm({ ...form, hero_description: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-stone-700">Contact details</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Location</label>
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-stone-700">Social media</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Instagram URL</label>
                <input
                  className="input"
                  type="url"
                  placeholder="https://instagram.com/yourpage"
                  value={form.instagram_url}
                  onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Facebook URL</label>
                <input
                  className="input"
                  type="url"
                  placeholder="https://facebook.com/yourpage"
                  value={form.facebook_url}
                  onChange={(e) => setForm({ ...form, facebook_url: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Pinterest URL</label>
                <input
                  className="input"
                  type="url"
                  placeholder="https://pinterest.com/yourpage"
                  value={form.pinterest_url}
                  onChange={(e) => setForm({ ...form, pinterest_url: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">Testimonials</h3>
              <button type="button" className="text-sm text-brand-700 hover:underline" onClick={addTestimonial}>
                Add testimonial
              </button>
            </div>
            <div className="mt-3 space-y-4">
              {form.testimonials.map((t, i) => (
                <div key={i} className="rounded-lg border border-stone-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">Name</label>
                      <input
                        className="input"
                        value={t.name}
                        onChange={(e) => setTestimonial(i, "name", e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Quote</label>
                      <textarea
                        className="input"
                        rows={2}
                        value={t.text}
                        onChange={(e) => setTestimonial(i, "text", e.target.value)}
                      />
                    </div>
                  </div>
                  {form.testimonials.length > 1 && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-red-500 hover:underline"
                      onClick={() => removeTestimonial(i)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <button className="btn-primary mt-6 px-6 py-2" disabled={save.isPending}>Save changes</button>
      </form>
    </div>
  );
}
