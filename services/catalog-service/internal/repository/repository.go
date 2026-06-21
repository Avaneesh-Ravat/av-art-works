// Package repository implements PostgreSQL persistence for the catalog service.
package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"avartworks/services/catalog-service/internal/domain"
)

// Repository provides catalog data access.
type Repository struct {
	pool *pgxpool.Pool
}

// New constructs a Repository.
func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

var sortClauses = map[string]string{
	"newest":     "p.created_at DESC",
	"price_asc":  "p.price_paise ASC",
	"price_desc": "p.price_paise DESC",
	"title":      "p.title ASC",
}

// ListProducts returns active products matching the query, plus the total count.
func (r *Repository) ListProducts(ctx context.Context, q domain.ProductQuery) ([]domain.Product, int, error) {
	var (
		where = []string{"p.is_active = true"}
		args  []any
	)
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if q.Search != "" {
		add("to_tsvector('english', p.title || ' ' || p.description) @@ plainto_tsquery('english', $%d)", q.Search)
	}
	if q.CategoryID != "" {
		add("p.category_id = $%d", q.CategoryID)
	}
	if q.Medium != "" {
		add("p.medium = $%d", q.Medium)
	}
	whereSQL := strings.Join(where, " AND ")

	var total int
	if err := r.pool.QueryRow(ctx, "SELECT count(*) FROM products p WHERE "+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	order := sortClauses[q.Sort]
	if order == "" {
		order = sortClauses["newest"]
	}
	limit := q.Limit
	if limit <= 0 || limit > 100 {
		limit = 12
	}
	page := q.Page
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit
	args = append(args, limit, offset)

	query := fmt.Sprintf(`
		SELECT p.id, COALESCE(p.category_id::text,''), p.title, p.slug, p.description,
		       p.price_paise, p.medium, p.is_active, p.created_at,
		       COALESCE(inv.quantity - inv.reserved, 0) AS stock
		FROM products p
		LEFT JOIN inventory inv ON inv.product_id = p.id
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d`, whereSQL, order, len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Description,
			&p.PricePaise, &p.Medium, &p.IsActive, &p.CreatedAt, &p.Stock); err != nil {
			return nil, 0, err
		}
		p.SetPriceFromPaise()
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if err := r.attachImages(ctx, products); err != nil {
		return nil, 0, err
	}
	return products, total, nil
}

func (r *Repository) scanProduct(row pgx.Row) (*domain.Product, error) {
	var p domain.Product
	err := row.Scan(&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Description,
		&p.PricePaise, &p.Medium, &p.IsActive, &p.CreatedAt, &p.Stock)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	p.SetPriceFromPaise()
	return &p, nil
}

const productSelect = `
	SELECT p.id, COALESCE(p.category_id::text,''), p.title, p.slug, p.description,
	       p.price_paise, p.medium, p.is_active, p.created_at,
	       COALESCE(inv.quantity - inv.reserved, 0) AS stock
	FROM products p
	LEFT JOIN inventory inv ON inv.product_id = p.id`

// GetProductBySlug fetches a product (with images) by slug.
func (r *Repository) GetProductBySlug(ctx context.Context, slug string) (*domain.Product, error) {
	p, err := r.scanProduct(r.pool.QueryRow(ctx, productSelect+" WHERE p.slug = $1", slug))
	if err != nil {
		return nil, err
	}
	return r.withImages(ctx, p)
}

// GetProductByID fetches a product (with images) by id.
func (r *Repository) GetProductByID(ctx context.Context, id string) (*domain.Product, error) {
	p, err := r.scanProduct(r.pool.QueryRow(ctx, productSelect+" WHERE p.id = $1", id))
	if err != nil {
		return nil, err
	}
	return r.withImages(ctx, p)
}

func (r *Repository) withImages(ctx context.Context, p *domain.Product) (*domain.Product, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, s3_key, sort_order FROM product_images WHERE product_id=$1 ORDER BY sort_order`, p.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var img domain.Image
		if err := rows.Scan(&img.ID, &img.S3Key, &img.SortOrder); err != nil {
			return nil, err
		}
		p.Images = append(p.Images, img)
	}
	return p, rows.Err()
}

// attachImages loads all images for a slice of products in one query.
func (r *Repository) attachImages(ctx context.Context, products []domain.Product) error {
	if len(products) == 0 {
		return nil
	}
	ids := make([]string, len(products))
	index := make(map[string]int, len(products))
	for i, p := range products {
		ids[i] = p.ID
		index[p.ID] = i
	}
	rows, err := r.pool.Query(ctx,
		`SELECT product_id, id, s3_key, sort_order FROM product_images
		 WHERE product_id = ANY($1) ORDER BY product_id, sort_order`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var productID string
		var img domain.Image
		if err := rows.Scan(&productID, &img.ID, &img.S3Key, &img.SortOrder); err != nil {
			return err
		}
		if i, ok := index[productID]; ok {
			products[i].Images = append(products[i].Images, img)
		}
	}
	return rows.Err()
}

// CreateProduct inserts a product and its initial inventory row.
func (r *Repository) CreateProduct(ctx context.Context, p *domain.Product, stock int) (*domain.Product, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const q = `
		INSERT INTO products (category_id, title, slug, description, price_paise, medium, is_active)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at`
	err = tx.QueryRow(ctx, q, p.CategoryID, p.Title, p.Slug, p.Description, p.PricePaise, p.Medium, p.IsActive).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, domain.ErrSlugExists
		}
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO inventory (product_id, quantity) VALUES ($1,$2)`, p.ID, stock); err != nil {
		return nil, err
	}
	p.Stock = stock
	p.SetPriceFromPaise()
	return p, tx.Commit(ctx)
}

// UpdateProduct updates mutable product fields.
func (r *Repository) UpdateProduct(ctx context.Context, p *domain.Product) (*domain.Product, error) {
	const q = `
		UPDATE products SET category_id=NULLIF($2,'')::uuid, title=$3, slug=$4,
		    description=$5, price_paise=$6, medium=$7, is_active=$8, updated_at=now()
		WHERE id=$1
		RETURNING created_at`
	err := r.pool.QueryRow(ctx, q, p.ID, p.CategoryID, p.Title, p.Slug, p.Description,
		p.PricePaise, p.Medium, p.IsActive).Scan(&p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return nil, domain.ErrSlugExists
		}
		return nil, err
	}
	p.SetPriceFromPaise()
	return r.GetProductByID(ctx, p.ID)
}

// DeleteProduct removes a product.
func (r *Repository) DeleteProduct(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// SetInventory sets the absolute quantity for a product.
func (r *Repository) SetInventory(ctx context.Context, productID string, quantity int) error {
	ct, err := r.pool.Exec(ctx,
		`INSERT INTO inventory (product_id, quantity) VALUES ($1,$2)
		 ON CONFLICT (product_id) DO UPDATE SET quantity=$2, updated_at=now()`, productID, quantity)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// AddImage attaches an image to a product.
func (r *Repository) AddImage(ctx context.Context, productID, s3Key string, sortOrder int) (*domain.Image, error) {
	var img domain.Image
	img.S3Key = s3Key
	img.SortOrder = sortOrder
	err := r.pool.QueryRow(ctx,
		`INSERT INTO product_images (product_id, s3_key, sort_order) VALUES ($1,$2,$3) RETURNING id`,
		productID, s3Key, sortOrder).Scan(&img.ID)
	return &img, err
}

// AddImages attaches multiple images to a product, appending after existing sort orders.
func (r *Repository) AddImages(ctx context.Context, productID string, keys []string) ([]domain.Image, error) {
	var clean []string
	for _, key := range keys {
		if key != "" {
			clean = append(clean, key)
		}
	}
	if len(clean) == 0 {
		return nil, nil
	}

	var maxSort int
	if err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(sort_order), -1) FROM product_images WHERE product_id=$1`, productID,
	).Scan(&maxSort); err != nil {
		return nil, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var images []domain.Image
	for i, key := range clean {
		var img domain.Image
		img.S3Key = key
		img.SortOrder = maxSort + 1 + i
		if err := tx.QueryRow(ctx,
			`INSERT INTO product_images (product_id, s3_key, sort_order) VALUES ($1,$2,$3) RETURNING id`,
			productID, key, img.SortOrder,
		).Scan(&img.ID); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return images, nil
}

// ---- Inventory reservation (called by the order service) ----

// Reserve moves qty from available to reserved; errors if insufficient stock.
func (r *Repository) Reserve(ctx context.Context, productID string, qty int) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE inventory SET reserved = reserved + $2, updated_at=now()
		 WHERE product_id=$1 AND quantity - reserved >= $2`, productID, qty)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrOutOfStock
	}
	return nil
}

// Release returns reserved stock back to available (e.g. on payment failure).
func (r *Repository) Release(ctx context.Context, productID string, qty int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE inventory SET reserved = GREATEST(reserved - $2, 0), updated_at=now()
		 WHERE product_id=$1`, productID, qty)
	return err
}

// Commit finalizes a sale: reduces both quantity and reserved.
func (r *Repository) Commit(ctx context.Context, productID string, qty int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE inventory SET quantity = GREATEST(quantity - $2, 0),
		     reserved = GREATEST(reserved - $2, 0), updated_at=now()
		 WHERE product_id=$1`, productID, qty)
	return err
}

// ---- Categories ----

// ListCategories returns all categories.
func (r *Repository) ListCategories(ctx context.Context) ([]domain.Category, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, slug, COALESCE(description,''), created_at FROM categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Category
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CreateCategory inserts a category.
func (r *Repository) CreateCategory(ctx context.Context, c *domain.Category) (*domain.Category, error) {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO categories (name, slug, description) VALUES ($1,$2,$3) RETURNING id, created_at`,
		c.Name, c.Slug, c.Description).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, domain.ErrSlugExists
		}
		return nil, err
	}
	return c, nil
}

// UpdateCategory updates a category.
func (r *Repository) UpdateCategory(ctx context.Context, c *domain.Category) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE categories SET name=$2, slug=$3, description=$4 WHERE id=$1`,
		c.ID, c.Name, c.Slug, c.Description)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.ErrSlugExists
		}
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// DeleteCategory removes a category.
func (r *Repository) DeleteCategory(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// CategoryIDBySlug resolves a category slug to its id ("" if not found).
func (r *Repository) CategoryIDBySlug(ctx context.Context, slug string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM categories WHERE slug=$1`, slug).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// ---- Site profile (singleton) ----

// GetSiteProfile returns the public site profile row.
func (r *Repository) GetSiteProfile(ctx context.Context) (*domain.SiteProfile, error) {
	const q = `
		SELECT site_name, footer_tagline, hero_tagline, hero_title, hero_description,
		       about_title, about_text, about_image_s3_key, email, phone, location,
		       instagram_url, facebook_url, pinterest_url, testimonials, updated_at
		FROM site_profile WHERE id = 1`
	var p domain.SiteProfile
	var testimonialsJSON []byte
	err := r.pool.QueryRow(ctx, q).Scan(
		&p.SiteName, &p.FooterTagline, &p.HeroTagline, &p.HeroTitle, &p.HeroDescription,
		&p.AboutTitle, &p.AboutText, &p.AboutImageS3Key, &p.Email, &p.Phone, &p.Location,
		&p.InstagramURL, &p.FacebookURL, &p.PinterestURL, &testimonialsJSON, &p.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if len(testimonialsJSON) > 0 {
		if err := json.Unmarshal(testimonialsJSON, &p.Testimonials); err != nil {
			return nil, err
		}
	}
	return &p, nil
}

// UpdateSiteProfile replaces the singleton site profile row.
func (r *Repository) UpdateSiteProfile(ctx context.Context, p *domain.SiteProfile) (*domain.SiteProfile, error) {
	testimonialsJSON, err := json.Marshal(p.Testimonials)
	if err != nil {
		return nil, err
	}
	const q = `
		UPDATE site_profile SET
		    site_name=$1, footer_tagline=$2, hero_tagline=$3, hero_title=$4, hero_description=$5,
		    email=$6, phone=$7, location=$8,
		    instagram_url=$9, facebook_url=$10, pinterest_url=$11, testimonials=$12, updated_at=now()
		WHERE id = 1
		RETURNING updated_at`
	err = r.pool.QueryRow(ctx, q,
		p.SiteName, p.FooterTagline, p.HeroTagline, p.HeroTitle, p.HeroDescription,
		p.Email, p.Phone, p.Location,
		p.InstagramURL, p.FacebookURL, p.PinterestURL, testimonialsJSON,
	).Scan(&p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

// UpdateAboutSection updates only the home page "About the artist" content.
func (r *Repository) UpdateAboutSection(ctx context.Context, title, text, imageKey string) (*domain.SiteProfile, error) {
	const q = `
		UPDATE site_profile SET
		    about_title=$1, about_text=$2, about_image_s3_key=$3, updated_at=now()
		WHERE id = 1
		RETURNING updated_at`
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx, q, title, text, imageKey).Scan(&updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	p, err := r.GetSiteProfile(ctx)
	if err != nil {
		return nil, err
	}
	p.UpdatedAt = updatedAt
	return p, nil
}
