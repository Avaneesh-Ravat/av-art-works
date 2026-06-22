// Package repository implements PostgreSQL persistence for the order service.
package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"avartworks/services/order-service/internal/domain"
)

// Repository provides order/cart/wishlist data access.
type Repository struct {
	pool *pgxpool.Pool
}

// New constructs a Repository.
func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// RawCartItem is a stored cart line without product enrichment.
type RawCartItem struct {
	ID        string
	ProductID string
	Quantity  int
}

// GetOrCreateCart returns the user's cart id, creating it if needed.
func (r *Repository) GetOrCreateCart(ctx context.Context, userID string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO carts (user_id) VALUES ($1)
		 ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
		 RETURNING id`, userID).Scan(&id)
	return id, err
}

// GetCartItems returns the raw items in a cart.
func (r *Repository) GetCartItems(ctx context.Context, cartID string) ([]RawCartItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, product_id, quantity FROM cart_items WHERE cart_id=$1 ORDER BY created_at`, cartID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RawCartItem
	for rows.Next() {
		var it RawCartItem
		if err := rows.Scan(&it.ID, &it.ProductID, &it.Quantity); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// AddToCart adds quantity to a product line (creating it if absent).
func (r *Repository) AddToCart(ctx context.Context, cartID, productID string, qty int) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1,$2,$3)
		 ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3`,
		cartID, productID, qty)
	return err
}

// UpdateCartItem sets the quantity of a cart line.
func (r *Repository) UpdateCartItem(ctx context.Context, cartID, itemID string, qty int) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE cart_items SET quantity=$3 WHERE id=$2 AND cart_id=$1`, cartID, itemID, qty)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// DeleteCartItem removes a cart line.
func (r *Repository) DeleteCartItem(ctx context.Context, cartID, itemID string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM cart_items WHERE id=$2 AND cart_id=$1`, cartID, itemID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// ClearCart removes all items from a cart.
func (r *Repository) ClearCart(ctx context.Context, cartID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID)
	return err
}

// CreateOrder persists an order and its items, and clears the cart, atomically.
func (r *Repository) CreateOrder(ctx context.Context, o *domain.Order, cartID string) (*domain.Order, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	addrJSON, err := json.Marshal(o.Address)
	if err != nil {
		return nil, err
	}
	err = tx.QueryRow(ctx,
		`INSERT INTO orders (user_id, total_paise, status, shipping_address)
		 VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		o.UserID, o.TotalPaise, domain.StatusPending, addrJSON).Scan(&o.ID, &o.CreatedAt)
	if err != nil {
		return nil, err
	}
	o.Status = domain.StatusPending

	for i := range o.Items {
		it := &o.Items[i]
		err = tx.QueryRow(ctx,
			`INSERT INTO order_items (order_id, product_id, title_snapshot, price_paise, quantity)
			 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			o.ID, it.ProductID, it.Title, it.PricePaise, it.Quantity).Scan(&it.ID)
		if err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID); err != nil {
		return nil, err
	}
	return o, tx.Commit(ctx)
}

func (r *Repository) loadItems(ctx context.Context, orderID string) ([]domain.OrderItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, product_id, title_snapshot, price_paise, quantity
		 FROM order_items WHERE order_id=$1`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.OrderItem
	for rows.Next() {
		var it domain.OrderItem
		if err := rows.Scan(&it.ID, &it.ProductID, &it.Title, &it.PricePaise, &it.Quantity); err != nil {
			return nil, err
		}
		it.Price = float64(it.PricePaise) / 100
		items = append(items, it)
	}
	return items, rows.Err()
}

func scanOrder(row pgx.Row) (*domain.Order, error) {
	var o domain.Order
	var addrJSON []byte
	err := row.Scan(&o.ID, &o.UserID, &o.TotalPaise, &o.Status, &addrJSON, &o.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	o.Total = float64(o.TotalPaise) / 100
	_ = json.Unmarshal(addrJSON, &o.Address)
	return &o, nil
}

const orderSelect = `SELECT id, user_id, total_paise, status, shipping_address, created_at FROM orders`

// GetOrder fetches a user's order with items.
func (r *Repository) GetOrder(ctx context.Context, userID, id string) (*domain.Order, error) {
	o, err := scanOrder(r.pool.QueryRow(ctx, orderSelect+" WHERE id=$1 AND user_id=$2", id, userID))
	if err != nil {
		return nil, err
	}
	o.Items, err = r.loadItems(ctx, o.ID)
	return o, err
}

// GetOrderByID fetches any order with items (admin/internal).
func (r *Repository) GetOrderByID(ctx context.Context, id string) (*domain.Order, error) {
	o, err := scanOrder(r.pool.QueryRow(ctx, orderSelect+" WHERE id=$1", id))
	if err != nil {
		return nil, err
	}
	o.Items, err = r.loadItems(ctx, o.ID)
	return o, err
}

// ListOrders lists a user's orders (without items).
func (r *Repository) ListOrders(ctx context.Context, userID string) ([]domain.Order, error) {
	return r.queryOrders(ctx, orderSelect+" WHERE user_id=$1 ORDER BY created_at DESC", userID)
}

// ListAllOrders lists all orders (admin).
func (r *Repository) ListAllOrders(ctx context.Context, limit, offset int) ([]domain.Order, error) {
	return r.queryOrders(ctx, orderSelect+" ORDER BY created_at DESC LIMIT $1 OFFSET $2", limit, offset)
}

func (r *Repository) queryOrders(ctx context.Context, q string, args ...any) ([]domain.Order, error) {
	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Order
	for rows.Next() {
		var o domain.Order
		var addrJSON []byte
		if err := rows.Scan(&o.ID, &o.UserID, &o.TotalPaise, &o.Status, &addrJSON, &o.CreatedAt); err != nil {
			return nil, err
		}
		o.Total = float64(o.TotalPaise) / 100
		_ = json.Unmarshal(addrJSON, &o.Address)
		out = append(out, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := r.attachItems(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// attachItems batch-loads order items for the given orders in a single query so
// list endpoints can show line items without an N+1 query per order.
func (r *Repository) attachItems(ctx context.Context, orders []domain.Order) error {
	if len(orders) == 0 {
		return nil
	}
	ids := make([]string, len(orders))
	for i := range orders {
		ids[i] = orders[i].ID
	}
	rows, err := r.pool.Query(ctx,
		`SELECT order_id, id, product_id, title_snapshot, price_paise, quantity
		 FROM order_items WHERE order_id = ANY($1)`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	byOrder := make(map[string][]domain.OrderItem, len(orders))
	for rows.Next() {
		var orderID string
		var it domain.OrderItem
		if err := rows.Scan(&orderID, &it.ID, &it.ProductID, &it.Title, &it.PricePaise, &it.Quantity); err != nil {
			return err
		}
		it.Price = float64(it.PricePaise) / 100
		byOrder[orderID] = append(byOrder[orderID], it)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i := range orders {
		orders[i].Items = byOrder[orders[i].ID]
	}
	return nil
}

// UpdateStatus sets the order status.
func (r *Repository) UpdateStatus(ctx context.Context, id, status string) error {
	ct, err := r.pool.Exec(ctx, `UPDATE orders SET status=$2, updated_at=now() WHERE id=$1`, id, status)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// ---- Wishlist ----

// AddWishlist adds a product to the wishlist (idempotent).
func (r *Repository) AddWishlist(ctx context.Context, userID, productID string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO wishlists (user_id, product_id) VALUES ($1,$2)
		 ON CONFLICT (user_id, product_id) DO NOTHING`, userID, productID)
	return err
}

// RemoveWishlist removes a product from the wishlist.
func (r *Repository) RemoveWishlist(ctx context.Context, userID, productID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2`, userID, productID)
	return err
}

// ListWishlist returns the product ids in a user's wishlist (newest first).
func (r *Repository) ListWishlist(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT product_id FROM wishlists WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
