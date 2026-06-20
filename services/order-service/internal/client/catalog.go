// Package client provides an HTTP client for the catalog service's internal
// API (product lookup and inventory reservation), used during checkout.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// Errors returned by the catalog client.
var (
	ErrProductNotFound = errors.New("product not found")
	ErrOutOfStock      = errors.New("insufficient stock")
)

// Product is the subset of catalog product data the order service needs.
type Product struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Slug       string `json:"slug"`
	PricePaise int64  `json:"price_paise"`
	IsActive   bool   `json:"is_active"`
	Stock      int    `json:"stock"`
}

// Catalog talks to the catalog service over HTTP using a shared internal token.
type Catalog struct {
	baseURL string
	token   string
	http    *http.Client
}

// NewCatalog constructs a catalog client.
func NewCatalog(baseURL, token string) *Catalog {
	return &Catalog{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Catalog) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var reader *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Internal-Token", c.token)
	req.Header.Set("Content-Type", "application/json")
	return c.http.Do(req)
}

// GetProduct fetches a product by id.
func (c *Catalog) GetProduct(ctx context.Context, id string) (*Product, error) {
	resp, err := c.do(ctx, http.MethodGet, "/internal/products/"+id, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrProductNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("catalog get product: status %d", resp.StatusCode)
	}
	var p Product
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (c *Catalog) inventoryOp(ctx context.Context, op, id string, qty int) error {
	resp, err := c.do(ctx, http.MethodPost,
		fmt.Sprintf("/internal/products/%s/%s", id, op), map[string]int{"qty": qty})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK:
		return nil
	case http.StatusConflict:
		return ErrOutOfStock
	case http.StatusNotFound:
		return ErrProductNotFound
	default:
		return fmt.Errorf("catalog %s: status %d", op, resp.StatusCode)
	}
}

// Reserve reserves stock for a product.
func (c *Catalog) Reserve(ctx context.Context, id string, qty int) error {
	return c.inventoryOp(ctx, "reserve", id, qty)
}

// Release frees previously reserved stock.
func (c *Catalog) Release(ctx context.Context, id string, qty int) error {
	return c.inventoryOp(ctx, "release", id, qty)
}

// Commit finalizes a sale (reduces stock).
func (c *Catalog) Commit(ctx context.Context, id string, qty int) error {
	return c.inventoryOp(ctx, "commit", id, qty)
}
