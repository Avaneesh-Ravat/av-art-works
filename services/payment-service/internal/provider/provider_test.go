package provider

import "testing"

func TestSimulateAndVerify(t *testing.T) {
	m := NewMockRazorpay("rzp_test_key", "secret123", "whsecret")
	orderID, _ := m.CreateOrder(50000, "rcpt_1")

	payID, sig := m.SimulatePayment(orderID)
	if !m.VerifyPaymentSignature(orderID, payID, sig) {
		t.Fatal("valid signature should verify")
	}
	if m.VerifyPaymentSignature(orderID, payID, "tampered") {
		t.Fatal("tampered signature must not verify")
	}
	if m.VerifyPaymentSignature("wrong_order", payID, sig) {
		t.Fatal("signature for a different order must not verify")
	}
}

func TestWebhookSignature(t *testing.T) {
	m := NewMockRazorpay("k", "s", "whsecret")
	body := []byte(`{"event":"payment.captured"}`)
	sig := m.SignWebhook(body)
	if !m.VerifyWebhookSignature(body, sig) {
		t.Fatal("valid webhook signature should verify")
	}
	if m.VerifyWebhookSignature([]byte(`{"event":"x"}`), sig) {
		t.Fatal("signature must not verify for modified body")
	}
}
