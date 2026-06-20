// Package service contains the payment-service business logic: creating
// payments (Razorpay-style online or Cash on Delivery), verifying signatures,
// processing webhooks, and issuing refunds. On capture it notifies the order
// service to mark the order paid.
package service

import (
	"context"
	"encoding/json"
	"log/slog"

	"avartworks/services/payment-service/internal/client"
	"avartworks/services/payment-service/internal/domain"
	"avartworks/services/payment-service/internal/provider"
	"avartworks/services/payment-service/internal/repository"
)

// Service holds payment dependencies.
type Service struct {
	repo     *repository.Repository
	provider provider.Provider
	orders   *client.OrderClient
	log      *slog.Logger
}

// New constructs the payment Service.
func New(repo *repository.Repository, p provider.Provider, orders *client.OrderClient, log *slog.Logger) *Service {
	return &Service{repo: repo, provider: p, orders: orders, log: log}
}

// CreateResult is returned after initiating a payment.
type CreateResult struct {
	Payment        *domain.Payment `json:"payment"`
	GatewayOrderID string          `json:"gateway_order_id,omitempty"`
	KeyID          string          `json:"key_id,omitempty"`
	AmountPaise    int64           `json:"amount_paise"`
	Gateway        string          `json:"gateway"`
}

// CreatePayment initiates payment for an order. For COD it records a pending
// payment and leaves the order pending; for online it registers a gateway order.
func (s *Service) CreatePayment(ctx context.Context, userID, orderID, method string) (*CreateResult, error) {
	order, err := s.orders.GetOrder(ctx, orderID)
	if err != nil {
		if err == client.ErrOrderNotFound {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if order.UserID != userID {
		return nil, domain.ErrForbidden
	}
	if order.Status != "pending" {
		return nil, domain.ErrOrderNotPay
	}

	p := &domain.Payment{
		OrderID:     orderID,
		UserID:      userID,
		AmountPaise: order.TotalPaise,
		Status:      domain.StatusCreated,
	}

	if method == domain.GatewayCOD {
		p.Gateway = domain.GatewayCOD
		created, err := s.repo.CreatePayment(ctx, p)
		if err != nil {
			return nil, err
		}
		return &CreateResult{Payment: created, Gateway: domain.GatewayCOD, AmountPaise: created.AmountPaise}, nil
	}

	// Online payment via the (mock) gateway.
	gatewayOrderID, err := s.provider.CreateOrder(order.TotalPaise, orderID)
	if err != nil {
		return nil, err
	}
	p.Gateway = domain.GatewayRazorpay
	p.GatewayOrderID = gatewayOrderID
	created, err := s.repo.CreatePayment(ctx, p)
	if err != nil {
		return nil, err
	}
	return &CreateResult{
		Payment:        created,
		GatewayOrderID: gatewayOrderID,
		KeyID:          s.provider.KeyID(),
		AmountPaise:    created.AmountPaise,
		Gateway:        domain.GatewayRazorpay,
	}, nil
}

// VerifyPayment validates the gateway signature and, if valid, captures the
// payment and marks the order paid.
func (s *Service) VerifyPayment(ctx context.Context, userID, paymentID, gatewayPaymentID, signature string) (*domain.Payment, error) {
	p, err := s.repo.GetPayment(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	if p.UserID != userID {
		return nil, domain.ErrForbidden
	}
	if p.Status == domain.StatusCaptured {
		return p, nil // idempotent
	}
	if !s.provider.VerifyPaymentSignature(p.GatewayOrderID, gatewayPaymentID, signature) {
		_ = s.repo.MarkStatus(ctx, p.ID, domain.StatusFailed)
		return nil, domain.ErrBadSignature
	}
	if err := s.repo.MarkCaptured(ctx, p.ID, gatewayPaymentID); err != nil {
		return nil, err
	}
	if err := s.orders.MarkPaid(ctx, p.OrderID); err != nil {
		s.log.Error("mark order paid failed", "order_id", p.OrderID, "err", err)
	}
	p.Status = domain.StatusCaptured
	p.GatewayPaymentID = gatewayPaymentID
	return p, nil
}

// HandleWebhook verifies and processes an inbound gateway webhook.
func (s *Service) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	if !s.provider.VerifyWebhookSignature(body, signature) {
		return domain.ErrBadSignature
	}
	var evt struct {
		ID      string `json:"id"`
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID      string `json:"id"`
					OrderID string `json:"order_id"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(body, &evt); err != nil {
		return err
	}
	// Idempotency: skip if we've already processed this event id.
	if evt.ID != "" {
		fresh, err := s.repo.RecordEvent(ctx, evt.ID, evt.Event, body)
		if err != nil {
			return err
		}
		if !fresh {
			return nil
		}
	}
	if evt.Event != "payment.captured" {
		return nil // ignore other events for the MVP
	}

	gatewayOrderID := evt.Payload.Payment.Entity.OrderID
	gatewayPaymentID := evt.Payload.Payment.Entity.ID
	p, err := s.repo.FindByGatewayOrderID(ctx, gatewayOrderID)
	if err != nil {
		return err
	}
	if p.Status == domain.StatusCaptured {
		return nil
	}
	if err := s.repo.MarkCaptured(ctx, p.ID, gatewayPaymentID); err != nil {
		return err
	}
	if err := s.orders.MarkPaid(ctx, p.OrderID); err != nil {
		s.log.Error("webhook mark paid failed", "order_id", p.OrderID, "err", err)
	}
	return nil
}

// GetPayment returns a payment scoped to the requesting user.
func (s *Service) GetPayment(ctx context.Context, userID, id string) (*domain.Payment, error) {
	p, err := s.repo.GetPayment(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.UserID != userID {
		return nil, domain.ErrForbidden
	}
	return p, nil
}

// Refund issues a refund for a captured payment (admin) and notifies the order.
func (s *Service) Refund(ctx context.Context, paymentID string) (*domain.Refund, error) {
	p, err := s.repo.GetPayment(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	if p.Status != domain.StatusCaptured {
		return nil, domain.ErrRefundNotAllow
	}
	refundID, err := s.provider.Refund(p.GatewayPaymentID, p.AmountPaise)
	if err != nil {
		return nil, err
	}
	ref := &domain.Refund{
		PaymentID:       p.ID,
		GatewayRefundID: refundID,
		AmountPaise:     p.AmountPaise,
		Status:          "processed",
	}
	created, err := s.repo.CreateRefund(ctx, ref)
	if err != nil {
		return nil, err
	}
	_ = s.repo.MarkStatus(ctx, p.ID, domain.StatusRefunded)
	if err := s.orders.MarkRefunded(ctx, p.OrderID); err != nil {
		s.log.Error("mark order refunded failed", "order_id", p.OrderID, "err", err)
	}
	return created, nil
}

// SimulatePayment is a MOCK-ONLY helper exposing the gateway's payment id and
// signature for a payment, so the verify flow can be tested without a real
// Razorpay account. Returns ("","") if the provider is not the mock.
func (s *Service) SimulatePayment(ctx context.Context, userID, paymentID string) (string, string, *domain.Payment, error) {
	p, err := s.repo.GetPayment(ctx, paymentID)
	if err != nil {
		return "", "", nil, err
	}
	if p.UserID != userID {
		return "", "", nil, domain.ErrForbidden
	}
	mock, ok := s.provider.(*provider.MockRazorpay)
	if !ok {
		return "", "", nil, domain.ErrForbidden
	}
	pid, sig := mock.SimulatePayment(p.GatewayOrderID)
	return pid, sig, p, nil
}
