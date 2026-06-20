// Package provider abstracts payment gateways. The Provider interface lets us
// swap the mock for real Razorpay/Stripe without changing business logic.
// The current implementation is a Razorpay-shaped mock suitable for India.
package provider

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"

	"github.com/google/uuid"
)

// Provider is a payment gateway integration.
type Provider interface {
	// Name identifies the gateway (e.g. "razorpay").
	Name() string
	// KeyID is the public key handed to the frontend checkout widget.
	KeyID() string
	// CreateOrder registers an order with the gateway and returns its id.
	CreateOrder(amountPaise int64, receipt string) (gatewayOrderID string, err error)
	// VerifyPaymentSignature validates the signature returned by the widget.
	VerifyPaymentSignature(gatewayOrderID, paymentID, signature string) bool
	// VerifyWebhookSignature validates an inbound webhook payload.
	VerifyWebhookSignature(body []byte, signature string) bool
	// Refund issues a refund and returns a refund id.
	Refund(paymentID string, amountPaise int64) (refundID string, err error)
}

// MockRazorpay mimics Razorpay's order/payment/signature flow locally, using
// the same HMAC-SHA256 signature scheme Razorpay uses, so the verification
// code path is identical to production.
type MockRazorpay struct {
	keyID         string
	keySecret     string
	webhookSecret string
}

// NewMockRazorpay builds the mock gateway.
func NewMockRazorpay(keyID, keySecret, webhookSecret string) *MockRazorpay {
	return &MockRazorpay{keyID: keyID, keySecret: keySecret, webhookSecret: webhookSecret}
}

// Name returns the gateway name.
func (m *MockRazorpay) Name() string { return "razorpay" }

// KeyID returns the public key id.
func (m *MockRazorpay) KeyID() string { return m.keyID }

// CreateOrder returns a Razorpay-style order id.
func (m *MockRazorpay) CreateOrder(_ int64, _ string) (string, error) {
	return "order_" + uuid.NewString()[:18], nil
}

func sign(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyPaymentSignature checks HMAC_SHA256(order_id|payment_id, keySecret).
func (m *MockRazorpay) VerifyPaymentSignature(gatewayOrderID, paymentID, signature string) bool {
	expected := sign(m.keySecret, gatewayOrderID+"|"+paymentID)
	return hmac.Equal([]byte(expected), []byte(signature))
}

// VerifyWebhookSignature checks HMAC_SHA256(body, webhookSecret).
func (m *MockRazorpay) VerifyWebhookSignature(body []byte, signature string) bool {
	expected := sign(m.webhookSecret, string(body))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// Refund returns a Razorpay-style refund id.
func (m *MockRazorpay) Refund(_ string, _ int64) (string, error) {
	return "rfnd_" + uuid.NewString()[:18], nil
}

// SimulatePayment is a MOCK-ONLY helper that mimics the gateway/checkout widget:
// it produces a payment id and a valid signature for a given order, so the
// verify flow can be exercised end-to-end without a real Razorpay account.
func (m *MockRazorpay) SimulatePayment(gatewayOrderID string) (paymentID, signature string) {
	paymentID = "pay_" + uuid.NewString()[:18]
	signature = sign(m.keySecret, gatewayOrderID+"|"+paymentID)
	return paymentID, signature
}

// SignWebhook is a MOCK-ONLY helper to produce a valid webhook signature.
func (m *MockRazorpay) SignWebhook(body []byte) string {
	return sign(m.webhookSecret, string(body))
}

// Ensure MockRazorpay satisfies Provider.
var _ Provider = (*MockRazorpay)(nil)
