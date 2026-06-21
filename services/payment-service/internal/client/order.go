// Package client provides an HTTP client for the order service's internal API
// (fetch order, mark paid/refunded), used by the payment flow.
package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// ErrOrderNotFound is returned when the order does not exist.
var ErrOrderNotFound = errors.New("order not found")

// Order is the subset of order data the payment service needs.
type Order struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	TotalPaise int64  `json:"total_paise"`
	Status     string `json:"status"`
}

// OrderClient talks to the order service over HTTP using a shared token.
type OrderClient struct {
	baseURL string
	token   string
	http    *http.Client
}

// NewOrderClient constructs an order client.
func NewOrderClient(baseURL, token string) *OrderClient {
	return &OrderClient{baseURL: baseURL, token: token, http: &http.Client{Timeout: 5 * time.Second}}
}

func (c *OrderClient) do(ctx context.Context, method, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Internal-Token", c.token)
	return c.http.Do(req)
}

// GetOrder fetches an order by id.
func (c *OrderClient) GetOrder(ctx context.Context, id string) (*Order, error) {
	resp, err := c.do(ctx, http.MethodGet, "/internal/orders/"+id)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrOrderNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("order get: status %d", resp.StatusCode)
	}
	var o Order
	if err := json.NewDecoder(resp.Body).Decode(&o); err != nil {
		return nil, err
	}
	return &o, nil
}

// MarkPaid notifies the order service that payment was captured.
func (c *OrderClient) MarkPaid(ctx context.Context, id string) error {
	resp, err := c.do(ctx, http.MethodPost, "/internal/orders/"+id+"/paid")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("order mark paid: status %d", resp.StatusCode)
	}
	return nil
}

// MarkRefunded notifies the order service that the order was refunded.
func (c *OrderClient) MarkRefunded(ctx context.Context, id string) error {
	resp, err := c.do(ctx, http.MethodPost, "/internal/orders/"+id+"/refunded")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("order mark refunded: status %d", resp.StatusCode)
	}
	return nil
}
