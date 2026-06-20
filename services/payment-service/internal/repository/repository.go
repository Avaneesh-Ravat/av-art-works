// Package repository implements PostgreSQL persistence for the payment service.
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"avartworks/services/payment-service/internal/domain"
)

// Repository provides payment data access.
type Repository struct {
	pool *pgxpool.Pool
}

// New constructs a Repository.
func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// CreatePayment inserts a payment record.
func (r *Repository) CreatePayment(ctx context.Context, p *domain.Payment) (*domain.Payment, error) {
	const q = `
		INSERT INTO payments (order_id, user_id, gateway, gateway_order_id, amount_paise, status)
		VALUES ($1,$2,$3,NULLIF($4,''),$5,$6)
		RETURNING id, created_at`
	err := r.pool.QueryRow(ctx, q, p.OrderID, p.UserID, p.Gateway, p.GatewayOrderID, p.AmountPaise, p.Status).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	p.SetAmount()
	return p, nil
}

func scanPayment(row pgx.Row) (*domain.Payment, error) {
	var p domain.Payment
	var goid, gpid *string
	err := row.Scan(&p.ID, &p.OrderID, &p.UserID, &p.Gateway, &goid, &gpid,
		&p.AmountPaise, &p.Status, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if goid != nil {
		p.GatewayOrderID = *goid
	}
	if gpid != nil {
		p.GatewayPaymentID = *gpid
	}
	p.SetAmount()
	return &p, nil
}

const paymentSelect = `
	SELECT id, order_id, user_id, gateway, gateway_order_id, gateway_payment_id,
	       amount_paise, status, created_at FROM payments`

// GetPayment fetches a payment by id.
func (r *Repository) GetPayment(ctx context.Context, id string) (*domain.Payment, error) {
	return scanPayment(r.pool.QueryRow(ctx, paymentSelect+" WHERE id=$1", id))
}

// MarkCaptured sets a payment captured with its gateway payment id.
func (r *Repository) MarkCaptured(ctx context.Context, id, gatewayPaymentID string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE payments SET status=$2, gateway_payment_id=$3, updated_at=now() WHERE id=$1`,
		id, domain.StatusCaptured, gatewayPaymentID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// MarkStatus sets a payment status.
func (r *Repository) MarkStatus(ctx context.Context, id, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE payments SET status=$2, updated_at=now() WHERE id=$1`, id, status)
	return err
}

// FindByGatewayPaymentID looks up a payment by its gateway payment id.
func (r *Repository) FindByGatewayPaymentID(ctx context.Context, gatewayPaymentID string) (*domain.Payment, error) {
	return scanPayment(r.pool.QueryRow(ctx, paymentSelect+" WHERE gateway_payment_id=$1", gatewayPaymentID))
}

// FindByGatewayOrderID looks up a payment by its gateway order id.
func (r *Repository) FindByGatewayOrderID(ctx context.Context, gatewayOrderID string) (*domain.Payment, error) {
	return scanPayment(r.pool.QueryRow(ctx, paymentSelect+" WHERE gateway_order_id=$1", gatewayOrderID))
}

// CreateRefund records a refund.
func (r *Repository) CreateRefund(ctx context.Context, ref *domain.Refund) (*domain.Refund, error) {
	const q = `
		INSERT INTO refunds (payment_id, gateway_refund_id, amount_paise, status)
		VALUES ($1,$2,$3,$4) RETURNING id, created_at`
	err := r.pool.QueryRow(ctx, q, ref.PaymentID, ref.GatewayRefundID, ref.AmountPaise, ref.Status).
		Scan(&ref.ID, &ref.CreatedAt)
	if err != nil {
		return nil, err
	}
	ref.Amount = float64(ref.AmountPaise) / 100
	return ref, nil
}

// RecordEvent stores a webhook event; returns false if already processed.
func (r *Repository) RecordEvent(ctx context.Context, eventID, eventType string, payload []byte) (bool, error) {
	ct, err := r.pool.Exec(ctx,
		`INSERT INTO payment_events (event_id, type, payload) VALUES ($1,$2,$3)
		 ON CONFLICT (event_id) DO NOTHING`, eventID, eventType, payload)
	if err != nil {
		return false, err
	}
	return ct.RowsAffected() > 0, nil
}
