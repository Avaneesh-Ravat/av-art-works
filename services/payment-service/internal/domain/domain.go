// Package domain holds the payment-service entities and errors.
package domain

import (
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrForbidden      = errors.New("forbidden")
	ErrBadSignature   = errors.New("invalid payment signature")
	ErrOrderNotPay    = errors.New("order is not payable")
	ErrAlreadyPaid    = errors.New("payment already captured")
	ErrRefundNotAllow = errors.New("payment cannot be refunded")
)

// Gateways.
const (
	GatewayRazorpay = "razorpay"
	GatewayCOD      = "cod"
)

// Payment statuses.
const (
	StatusCreated    = "created"
	StatusAuthorized = "authorized"
	StatusCaptured   = "captured"
	StatusFailed     = "failed"
	StatusRefunded   = "refunded"
)

// Payment is a payment attempt against an order.
type Payment struct {
	ID               string    `json:"id"`
	OrderID          string    `json:"order_id"`
	UserID           string    `json:"user_id"`
	Gateway          string    `json:"gateway"`
	GatewayOrderID   string    `json:"gateway_order_id,omitempty"`
	GatewayPaymentID string    `json:"gateway_payment_id,omitempty"`
	AmountPaise      int64     `json:"amount_paise"`
	Amount           float64   `json:"amount"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

// SetAmount syncs the rupee field from paise.
func (p *Payment) SetAmount() { p.Amount = float64(p.AmountPaise) / 100 }

// Refund records a refund against a payment.
type Refund struct {
	ID              string    `json:"id"`
	PaymentID       string    `json:"payment_id"`
	GatewayRefundID string    `json:"gateway_refund_id,omitempty"`
	AmountPaise     int64     `json:"amount_paise"`
	Amount          float64   `json:"amount"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}
