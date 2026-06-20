// Package repository implements PostgreSQL persistence for the catalog service.
package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

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
		       COALESCE(inv.quantity - inv.reserved, 0) AS stock,
		       COALESCE(img.s3_key, '') AS thumb
		FROM products p
		LEFT JOIN inventory inv ON inv.product_id = p.id
		LEFT JOIN LATERAL (
		    SELECT s3_key FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1
		) img ON true
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
		var thumb string
		if err := rows.Scan(&p.ID, &p.CategoryID, &p.Title, &p.Slug, &p.Description,
			&p.PricePaise, &p.Medium, &p.IsActive, &p.CreatedAt, &p.Stock, &thumb); err != nil {
			return nil, 0, err
		}
		p.SetPriceFromPaise()
		if thumb != "" {
			p.Images = []domain.Image{{S3Key: thumb}}
		}
		products = append(products, p)
	}
	return products, total, rows.Err()
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
