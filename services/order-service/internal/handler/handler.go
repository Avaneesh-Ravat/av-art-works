// Package handler exposes the order-service HTTP API.
package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"avartworks/pkg/auth"
	"avartworks/pkg/httpx"
	"avartworks/services/order-service/docs"
	"avartworks/services/order-service/internal/domain"
	"avartworks/services/order-service/internal/service"
)

// Handler wires order routes to the service layer.
type Handler struct {
	svc           *service.Service
	auth          *auth.Manager
	internalToken string
}

// New constructs a Handler.
func New(svc *service.Service, a *auth.Manager, internalToken string) *Handler {
	return &Handler{svc: svc, auth: a, internalToken: internalToken}
}

// Routes mounts order routes.
func (h *Handler) Routes(corsOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(httpx.CORS(corsOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "order-service"})
	})
	httpx.MountSwagger(r, docs.OpenAPISpec)

	r.Route("/api/v1", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(httpx.RequireAuth(h.auth))

			r.Get("/cart", h.getCart)
			r.Post("/cart/items", h.addToCart)
			r.Patch("/cart/items/{id}", h.updateCartItem)
			r.Delete("/cart/items/{id}", h.removeCartItem)

			r.Post("/orders", h.checkout)
			r.Get("/orders", h.listOrders)
			r.Get("/orders/{id}", h.getOrder)

			r.Get("/wishlist", h.listWishlist)
			r.Post("/wishlist", h.addWishlist)
			r.Delete("/wishlist/{productID}", h.removeWishlist)

			r.Group(func(r chi.Router) {
				r.Use(httpx.RequireAdmin)
				r.Get("/admin/orders", h.listAllOrders)
				r.Patch("/admin/orders/{id}/status", h.updateStatus)
			})
		})
	})

	r.Route("/internal", func(r chi.Router) {
		r.Use(h.requireInternal)
		r.Get("/orders/{id}", h.getOrderInternal)
		r.Post("/orders/{id}/paid", h.markPaid)
		r.Post("/orders/{id}/refunded", h.markRefunded)
	})
	return r
}

func (h *Handler) requireInternal(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.internalToken == "" || r.Header.Get("X-Internal-Token") != h.internalToken {
			httpx.Error(w, http.StatusUnauthorized, "unauthorized", "invalid internal token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---- DTOs ----

type addItemReq struct {
	ProductID string `json:"product_id" validate:"required,uuid"`
	Quantity  int    `json:"quantity" validate:"required,gt=0"`
}

type qtyReq struct {
	Quantity int `json:"quantity" validate:"required,gt=0"`
}

type checkoutReq struct {
	ShippingAddress domain.Address `json:"shipping_address"`
}

type wishlistReq struct {
	ProductID string `json:"product_id" validate:"required,uuid"`
}

type statusReq struct {
	Status string `json:"status" validate:"required"`
}

// ---- Cart handlers ----

func (h *Handler) getCart(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	cart, err := h.svc.GetCart(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not load cart")
		return
	}
	httpx.JSON(w, http.StatusOK, cart)
}

func (h *Handler) addToCart(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	var req addItemReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.AddToCart(r.Context(), uid, req.ProductID, req.Quantity); err != nil {
		if errors.Is(err, domain.ErrProductInvalid) {
			httpx.Error(w, http.StatusBadRequest, "product_invalid", "product is unavailable")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not add to cart")
		return
	}
	cart, _ := h.svc.GetCart(r.Context(), uid)
	httpx.JSON(w, http.StatusOK, cart)
}

func (h *Handler) updateCartItem(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	var req qtyReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.UpdateCartItem(r.Context(), uid, chi.URLParam(r, "id"), req.Quantity); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "cart item not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not update item")
		return
	}
	cart, _ := h.svc.GetCart(r.Context(), uid)
	httpx.JSON(w, http.StatusOK, cart)
}

func (h *Handler) removeCartItem(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	if err := h.svc.RemoveCartItem(r.Context(), uid, chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "cart item not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not remove item")
		return
	}
	cart, _ := h.svc.GetCart(r.Context(), uid)
	httpx.JSON(w, http.StatusOK, cart)
}

// ---- Order handlers ----

func (h *Handler) checkout(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	var req checkoutReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	order, err := h.svc.Checkout(r.Context(), uid, req.ShippingAddress)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrEmptyCart):
			httpx.Error(w, http.StatusBadRequest, "empty_cart", "your cart is empty")
		case errors.Is(err, domain.ErrBadAddress):
			httpx.Error(w, http.StatusBadRequest, "bad_address", "shipping address requires line1, city and pincode")
		case errors.Is(err, domain.ErrOutOfStock):
			httpx.Error(w, http.StatusConflict, "out_of_stock", "one or more items are out of stock")
		case errors.Is(err, domain.ErrProductInvalid):
			httpx.Error(w, http.StatusBadRequest, "product_invalid", "a product in your cart is unavailable")
		default:
			httpx.Error(w, http.StatusInternalServerError, "internal", "could not place order")
		}
		return
	}
	httpx.JSON(w, http.StatusCreated, order)
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	orders, err := h.svc.ListOrders(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not list orders")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": orders})
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	order, err := h.svc.GetOrder(r.Context(), uid, chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	httpx.JSON(w, http.StatusOK, order)
}

// ---- Wishlist handlers ----

func (h *Handler) listWishlist(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	items, err := h.svc.ListWishlist(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not load wishlist")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) addWishlist(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	var req wishlistReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.AddWishlist(r.Context(), uid, req.ProductID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not add to wishlist")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"status": "added"})
}

func (h *Handler) removeWishlist(w http.ResponseWriter, r *http.Request) {
	uid := httpx.ClaimsFrom(r.Context()).UserID
	if err := h.svc.RemoveWishlist(r.Context(), uid, chi.URLParam(r, "productID")); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not remove from wishlist")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- Admin handlers ----

func (h *Handler) listAllOrders(w http.ResponseWriter, r *http.Request) {
	limit := parseIntDefault(r.URL.Query().Get("limit"), 20)
	offset := parseIntDefault(r.URL.Query().Get("offset"), 0)
	orders, err := h.svc.ListAllOrders(r.Context(), limit, offset)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not list orders")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": orders})
}

func (h *Handler) updateStatus(w http.ResponseWriter, r *http.Request) {
	var req statusReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.UpdateStatus(r.Context(), chi.URLParam(r, "id"), req.Status); err != nil {
		switch {
		case errors.Is(err, domain.ErrBadStatus):
			httpx.Error(w, http.StatusBadRequest, "bad_status", "invalid status")
		case errors.Is(err, domain.ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
		default:
			httpx.Error(w, http.StatusInternalServerError, "internal", "could not update status")
		}
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": req.Status})
}

// ---- Internal handlers ----

func (h *Handler) getOrderInternal(w http.ResponseWriter, r *http.Request) {
	order, err := h.svc.GetOrderByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	httpx.JSON(w, http.StatusOK, order)
}

func (h *Handler) markRefunded(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.UpdateStatus(r.Context(), chi.URLParam(r, "id"), domain.StatusRefunded); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not mark refunded")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "refunded"})
}

func (h *Handler) markPaid(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.MarkPaid(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not mark paid")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "paid"})
}

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 0 {
		return def
	}
	return n
}
