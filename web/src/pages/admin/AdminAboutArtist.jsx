import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, uploadImage } from "../../lib/api";
import { useSiteProfile } from "../../lib/hooks";
import { Spinner } from "../../components/Spinner";

const fileInputClass =
  "block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700";

export function AdminAboutArtist() {
  const qc = useQueryClient();
  const { data, isLoading } = useSiteProfile();
  const [form, setForm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (data && !form) {
      setForm({
        about_title: data.about_title,
        about_text: data.about_text,
        about_image_s3_key: data.about_image_s3_key ?? "",
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;

      const payload = {
        about_title: form.about_title,
        about_text: form.about_text,
      };

      if (imageFile) {
        payload.about_image_s3_key = await uploadImage(imageFile);
      } else if (imageUrl.trim()) {
        payload.about_image_s3_key = imageUrl.trim();
      } else if (removeImage) {
        payload.about_image_s3_key = "";
      } else if (form.about_image_s3_key) {
        payload.about_image_s3_key = form.about_image_s3_key;
      }

      return api.patch("/v1/site-profile/about", payload);
    },
    onSuccess: (updated) => {
      if (!updated) return;
      qc.setQueryData(["site-profile"], updated);
      qc.invalidateQueries({ queryKey: ["site-profile"] });
      setForm({
        about_title: updated.about_title,
        about_text: updated.about_text,
        about_image_s3_key: updated.about_image_s3_key ?? "",
      });
      setImageFile(null);
      setImageUrl("");
      setRemoveImage(false);
      setFileInputKey((k) => k + 1);
      setMsg("About section updated. Changes appear on the home page.");
      setError("");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Save failed"),
  });

  const previewUrl = useMemo(() => {
    if (removeImage) return undefined;
    if (imageFile) return URL.createObjectURL(imageFile);
    if (imageUrl.trim()) return imageUrl.trim();
    return data?.about_image_url;
  }, [removeImage, imageFile, imageUrl, data?.about_image_url]);

  if (isLoading || !form) return <Spinner />;

  const hasSavedImage = Boolean(data?.about_image_url && !removeImage);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-stone-800">About the artist</h2>
        <p className="mt-1 text-sm text-stone-500">
          Edit the image and text shown in the home page &ldquo;About the artist&rdquo; section.
        </p>
      </div>

      <form
        className="card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          save.mutate();
        }}
      >
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {msg && <p className="mb-4 rounded bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</p>}

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-lg border border-stone-200 p-4">
              <h3 className="text-sm font-semibold text-stone-800">Artist image</h3>
              <p className="mt-1 text-xs text-stone-500">
                This photo appears in the About the artist section on the home page.
              </p>

              {hasSavedImage && !imageFile && !imageUrl.trim() && (
                <div className="mt-4">
                  <p className="label">Current image</p>
                  <img
                    src={data?.about_image_url}
                    alt="Current artist"
                    className="mt-1 h-40 w-40 rounded-lg object-cover"
                  />
                </div>
              )}

              <div className="mt-4">
                <label className="label">Upload new photo</label>
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*"
                  className={fileInputClass}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setImageFile(file);
                    setRemoveImage(false);
                    if (file) setImageUrl("");
                  }}
                />
                {imageFile && (
                  <p className="mt-1 text-xs text-stone-500">{imageFile.name} — uploaded on save.</p>
                )}
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-stone-500">Or paste an image URL</summary>
                <input
                  className="input mt-2 font-mono text-xs"
                  type="url"
                  placeholder="https://example.com/artist-photo.jpg"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImageFile(null);
                    setRemoveImage(false);
                  }}
                />
              </details>

              {(hasSavedImage || imageFile || imageUrl.trim()) && (
                <button
                  type="button"
                  className="mt-4 text-sm text-red-500 hover:underline"
                  onClick={() => {
                    setImageFile(null);
                    setImageUrl("");
                    setRemoveImage(true);
                    setFileInputKey((k) => k + 1);
                  }}
                >
                  Remove image
                </button>
              )}
            </section>

            <section>
              <div>
                <label className="label">Section title</label>
                <input
                  className="input"
                  required
                  value={form.about_title}
                  onChange={(e) => setForm({ ...form, about_title: e.target.value })}
                />
              </div>
              <div className="mt-4">
                <label className="label">About text</label>
                <textarea
                  className="input"
                  rows={8}
                  value={form.about_text}
                  onChange={(e) => setForm({ ...form, about_text: e.target.value })}
                  placeholder="Tell visitors about yourself and your art…"
                />
              </div>
            </section>
          </div>

          <div>
            <p className="label mb-2">Home page preview</p>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="aspect-square bg-stone-100">
                {previewUrl ? (
                  <img src={previewUrl} alt="About preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-xl text-stone-400">
                    The Artist
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-bold text-stone-900">
                  {form.about_title || "About the artist"}
                </h3>
                <p className="mt-2 text-sm text-stone-600">
                  {form.about_text || "Your about text will appear here."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button className="btn-primary mt-6 px-6 py-2" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save about section"}
        </button>
      </form>
    </div>
  );
}
