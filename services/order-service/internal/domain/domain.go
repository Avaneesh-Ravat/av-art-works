// Package domain holds the order-service entities and errors.
package domain

import (
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrEmptyCart      = errors.New("cart is empty")
	ErrOutOfStock     = errors.New("insufficient stock")
	ErrProductInvalid = errors.New("product unavailable")
	ErrBadStatus      = errors.New("invalid status transition")
	ErrBadAddress     = errors.New("invalid shipping address")
)

// Order statuses.
const (
	StatusPending   = "pending"
	StatusPaid      = "paid"
	StatusShipped   = "shipped"
	StatusDelivered = "delivered"
	StatusCancelled = "cancelled"
	StatusRefunded  = "refunded"
)

// ValidStatuses lists allowed order statuses.
var ValidStatuses = map[string]bool{
	StatusPending: true, StatusPaid: true, StatusShipped: true,
	StatusDelivered: true, StatusCancelled: true, StatusRefunded: true,
}

// CartItem is a line in the cart, enriched with live product data on read.
type CartItem struct {
	ID         string  `json:"id"`
	ProductID  string  `json:"product_id"`
	Title      string  `json:"title"`
	Slug       string  `json:"slug,omitempty"`
	PricePaise int64   `json:"price_paise"`
	Price      float64 `json:"price"`
	Quantity   int     `json:"quantity"`
	Stock      int     `json:"stock"`
	LinePaise  int64   `json:"line_total_paise"`
}

// Cart is a user's shopping cart.
type Cart struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Items      []CartItem `json:"items"`
	TotalPaise int64      `json:"total_paise"`
	Total      float64    `json:"total"`
}

// Address is a shipping address snapshot stored on the order.
type Address struct {
	Line1    string `json:"line1"`
	Line2    string `json:"line2,omitempty"`
	Locality string `json:"locality"`
	City     string `json:"city"`
	State    string `json:"state"`
	Pincode  string `json:"pincode"`
	Country  string `json:"country"`
}

// OrderItem is a purchased line with price/title snapshots.
type OrderItem struct {
	ID         string  `json:"id"`
	ProductID  string  `json:"product_id"`
	Title      string  `json:"title"`
	PricePaise int64   `json:"price_paise"`
	Price      float64 `json:"price"`
	Quantity   int     `json:"quantity"`
}

// Order is a placed order.
type Order struct {
	ID         string      `json:"id"`
	UserID     string      `json:"user_id"`
	Items      []OrderItem `json:"items"`
	TotalPaise int64       `json:"total_paise"`
	Total      float64     `json:"total"`
	Status     string      `json:"status"`
	Address    Address     `json:"shipping_address"`
	CreatedAt  time.Time   `json:"created_at"`
}

// WishlistItem is a saved product, enriched on read.
type WishlistItem struct {
	ProductID  string    `json:"product_id"`
	Title      string    `json:"title"`
	Slug       string    `json:"slug,omitempty"`
	Price      float64   `json:"price"`
	PricePaise int64     `json:"price_paise"`
	CreatedAt  time.Time `json:"created_at"`
}
