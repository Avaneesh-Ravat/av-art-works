-- Seed categories matching the AV Art Works product lines.
INSERT INTO categories (name, slug, description) VALUES
    ('Resin Art', 'resin-art', 'Glossy, durable resin artworks and coasters.'),
    ('Texture Art', 'texture-art', 'Tactile, layered texture paintings.'),
    ('Acrylic Paintings', 'acrylic-paintings', 'Vibrant acrylic canvas paintings.'),
    ('Customized Paintings', 'customized-paintings', 'Bespoke commissions made to order.'),
    ('Handmade Artwork', 'handmade-artwork', 'One-of-a-kind handmade pieces.')
ON CONFLICT (slug) DO NOTHING;

-- Seed a few products with inventory.
WITH ins AS (
    INSERT INTO products (category_id, title, slug, description, price_paise, medium)
    SELECT c.id, v.title, v.slug, v.description, v.price_paise, v.medium
    FROM (VALUES
        ('resin-art',        'Ocean Wave Resin Tray',  'ocean-wave-resin-tray',  'A flowing ocean-themed resin serving tray.', 250000::bigint, 'resin'),
        ('texture-art',      'Golden Horizon Texture', 'golden-horizon-texture', 'Layered gold and white texture canvas.',     480000::bigint, 'texture'),
        ('acrylic-paintings','Sunset Valley Acrylic',  'sunset-valley-acrylic',  'Warm-toned acrylic landscape on canvas.',    360000::bigint, 'acrylic'),
        ('handmade-artwork', 'Mandala Wall Hanging',   'mandala-wall-hanging',   'Hand-painted mandala wall decor.',           150000::bigint, 'handmade')
    ) AS v(cat_slug, title, slug, description, price_paise, medium)
    JOIN categories c ON c.slug = v.cat_slug
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
)
INSERT INTO inventory (product_id, quantity)
SELECT id, 10 FROM ins
ON CONFLICT (product_id) DO NOTHING;
