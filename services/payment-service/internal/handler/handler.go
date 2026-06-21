// Package handler exposes the payment-service HTTP API.
package handler

import (
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"avartworks/pkg/auth"
	"avartworks/pkg/httpx"
	"avartworks/services/payment-service/docs"
	"avartworks/services/payment-service/internal/domain"
	"avartworks/services/payment-service/internal/service"
)

// Handler wires payment routes to the service layer.
type Handler struct {
	svc  *service.Service
	auth *auth.Manager
}

// New constructs a Handler.
func New(svc *service.Service, a *auth.Manager) *Handler {
	return &Handler{svc: svc, auth: a}
}

// Routes mounts payment routes.
func (h *Handler) Routes(corsOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(httpx.CORS(corsOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "payment-service"})
	})
	httpx.MountSwagger(r, docs.OpenAPISpec)

	r.Route("/api/v1", func(r chi.Router) {
		// Webhook is unauthenticated but HMAC-verified.
		r.Post("/payments/webhook", h.webhook)

		r.Group(func(r chi.Router) {
			r.Use(httpx.RequireAuth(h.auth))
			r.Post("/payments", h.create)
			r.Post("/payments/verify", h.verify)
			r.Post("/payments/{id}/simulate", h.simulate)
			r.Get("/payments/{id}", h.get)

			r.Group(func(r chi.Router) {
				r.Use(httpx.RequireAdmin)
				r.Post("/payments/{id}/refund", h.refund)
			})
		})
	})
	return r
}

// ---- DTOs ----

type createReq struct {
	OrderID string `json:"order_id" validate:"required,uuid"`
	Method  string `json:"method"` // "razorpay" (default) or "cod"
}

type verifyReq struct {
	PaymentID         string `json:"payment_id" validate:"required,uuid"`
	RazorpayPaymentID string `json:"razorpay_payment_id" validate:"required"`
	RazorpaySignature string `json:"razorpay_signature" validate:"required"`
}

// ---- Handlers ----

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	var req createReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	method := req.Method
	if method == "" {
		method = domain.GatewayRazorpay
	}
	res, err := h.svc.CreatePayment(r.Context(), uid, req.OrderID, method)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
		case errors.Is(err, domain.ErrForbidden):
			httpx.Error(w, http.StatusForbidden, "forbidden", "not your order")
		case errors.Is(err, domain.ErrOrderNotPay):
			httpx.Error(w, http.StatusConflict, "not_payable", "order is not payable")
		default:
			httpx.Error(w, http.StatusInternalServerError, "internal", "could not create payment")
		}
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) verify(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	var req verifyReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	p, err := h.svc.VerifyPayment(r.Context(), uid, req.PaymentID, req.RazorpayPaymentID, req.RazorpaySignature)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrBadSignature):
			httpx.Error(w, http.StatusBadRequest, "bad_signature", "payment signature verification failed")
		case errors.Is(err, domain.ErrForbidden):
			httpx.Error(w, http.StatusForbidden, "forbidden", "not your payment")
		case errors.Is(err, domain.ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "not_found", "payment not found")
		default:
			httpx.Error(w, http.StatusInternalServerError, "internal", "could not verify payment")
		}
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) simulate(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	pid, sig, p, err := h.svc.SimulatePayment(r.Context(), uid, chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			httpx.Error(w, http.StatusForbidden, "forbidden", "simulation unavailable")
			return
		}
		httpx.Error(w, http.StatusNotFound, "not_found", "payment not found")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"payment_id":          p.ID,
		"razorpay_payment_id": pid,
		"razorpay_signature":  sig,
		"note":                "MOCK helper simulating the Razorpay checkout widget",
	})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	p, err := h.svc.GetPayment(r.Context(), uid, chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, domain.ErrForbidden) {
			httpx.Error(w, http.StatusForbidden, "forbidden", "not your payment")
			return
		}
		httpx.Error(w, http.StatusNotFound, "not_found", "payment not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) webhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_body", "could not read body")
		return
	}
	signature := r.Header.Get("X-Razorpay-Signature")
	if err := h.svc.HandleWebhook(r.Context(), body, signature); err != nil {
		if errors.Is(err, domain.ErrBadSignature) {
			httpx.Error(w, http.StatusBadRequest, "bad_signature", "webhook signature verification failed")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not process webhook")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) refund(w http.ResponseWriter, r *http.Request) {
	ref, err := h.svc.Refund(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "not_found", "payment not found")
		case errors.Is(err, domain.ErrRefundNotAllow):
			httpx.Error(w, http.StatusConflict, "not_refundable", "only captured payments can be refunded")
		default:
			httpx.Error(w, http.StatusInternalServerError, "internal", "could not refund")
		}
		return
	}
	httpx.JSON(w, http.StatusOK, ref)
}
