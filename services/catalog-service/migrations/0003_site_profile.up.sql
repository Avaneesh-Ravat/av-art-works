-- Singleton row for public site / artist profile content (editable by admin).
CREATE TABLE IF NOT EXISTS site_profile (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    site_name           TEXT NOT NULL DEFAULT 'AV Art Works',
    footer_tagline      TEXT NOT NULL DEFAULT '',
    hero_tagline        TEXT NOT NULL DEFAULT '',
    hero_title          TEXT NOT NULL DEFAULT '',
    hero_description    TEXT NOT NULL DEFAULT '',
    about_title         TEXT NOT NULL DEFAULT 'About the artist',
    about_text          TEXT NOT NULL DEFAULT '',
    about_image_s3_key  TEXT NOT NULL DEFAULT '',
    email               TEXT NOT NULL DEFAULT '',
    phone               TEXT NOT NULL DEFAULT '',
    location            TEXT NOT NULL DEFAULT '',
    instagram_url       TEXT NOT NULL DEFAULT '',
    facebook_url        TEXT NOT NULL DEFAULT '',
    pinterest_url       TEXT NOT NULL DEFAULT '',
    testimonials        JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_profile (
    id,
    site_name,
    footer_tagline,
    hero_tagline,
    hero_title,
    hero_description,
    about_title,
    about_text,
    email,
    phone,
    location,
    instagram_url,
    facebook_url,
    pinterest_url,
    testimonials
) VALUES (
    1,
    'AV Art Works',
    'Handcrafted resin, texture, acrylic and customized paintings, made with love in India.',
    'Handcrafted in India',
    'Art that brings your walls to life',
    'Original resin, texture, acrylic and customized paintings, each piece thoughtfully made by hand.',
    'About the artist',
    'AV Art Works is a small studio devoted to handmade art. Every painting begins as a blank canvas and becomes a one-of-a-kind piece through layers of resin, texture and color. We believe art should feel personal, which is why we love creating customized commissions for our customers.',
    'hello@avartworks.in',
    '+91 98765 43210',
    'Bengaluru, India',
    'https://instagram.com',
    'https://facebook.com',
    'https://pinterest.com',
    '[
        {"name":"Ananya R.","text":"The resin tray I ordered is even more stunning in person. Beautiful craftsmanship!"},
        {"name":"Vikram S.","text":"Commissioned a custom acrylic piece for my living room. The process was smooth and personal."},
        {"name":"Meera K.","text":"Gorgeous texture art, carefully packed and delivered on time. Highly recommend."}
    ]'::jsonb
) ON CONFLICT (id) DO NOTHING;
