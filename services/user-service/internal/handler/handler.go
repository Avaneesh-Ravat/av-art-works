// Package handler exposes the user-service HTTP API.
package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"avartworks/pkg/auth"
	"avartworks/pkg/httpx"
	"avartworks/services/user-service/docs"
	"avartworks/services/user-service/internal/domain"
	"avartworks/services/user-service/internal/service"
)

// Handler wires HTTP routes to the service layer.
type Handler struct {
	svc  *service.Service
	auth *auth.Manager
}

// New constructs a Handler.
func New(svc *service.Service, a *auth.Manager) *Handler {
	return &Handler{svc: svc, auth: a}
}

// Routes mounts the user-service routes onto a router.
func (h *Handler) Routes(corsOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(httpx.CORS(corsOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "user-service"})
	})

	httpx.MountSwagger(r, docs.OpenAPISpec)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/register", h.register)
		r.Post("/auth/login", h.login)
		r.Post("/auth/refresh", h.refresh)
		r.Post("/auth/logout", h.logout)
		r.Post("/auth/forgot-password", h.forgotPassword)
		r.Post("/auth/reset-password", h.resetPassword)

		// Authenticated routes.
		r.Group(func(r chi.Router) {
			r.Use(httpx.RequireAuth(h.auth))
			r.Get("/users/me", h.getMe)
			r.Put("/users/me", h.updateMe)
			r.Get("/users/me/addresses", h.listAddresses)
			r.Post("/users/me/addresses", h.addAddress)
			r.Delete("/users/me/addresses/{id}", h.deleteAddress)

			// Admin-only.
			r.Group(func(r chi.Router) {
				r.Use(httpx.RequireAdmin)
				r.Get("/admin/users", h.listUsers)
			})
		})
	})
	return r
}

// ---- DTOs ----

type registerReq struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	FullName string `json:"full_name" validate:"required"`
	Phone    string `json:"phone"`
}

type loginReq struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type forgotReq struct {
	Email string `json:"email" validate:"required,email"`
}

type resetReq struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

type updateProfileReq struct {
	FullName string `json:"full_name" validate:"required"`
	Phone    string `json:"phone"`
}

type addressReq struct {
	Line1     string `json:"line1" validate:"required"`
	Line2     string `json:"line2"`
	City      string `json:"city" validate:"required"`
	State     string `json:"state" validate:"required"`
	Pincode   string `json:"pincode" validate:"required"`
	Country   string `json:"country"`
	IsDefault bool   `json:"is_default"`
}

// ---- Handlers ----

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	u, err := h.svc.Register(r.Context(), req.Email, req.Password, req.FullName, req.Phone)
	if err != nil {
		if errors.Is(err, domain.ErrEmailExists) {
			httpx.Error(w, http.StatusConflict, "email_exists", "email already registered")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not register")
		return
	}
	httpx.JSON(w, http.StatusCreated, u)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	pair, u, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidCreds) {
			httpx.Error(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not login")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"user":          u,
	})
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	pair, err := h.svc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid_token", "invalid or expired refresh token")
		return
	}
	httpx.JSON(w, http.StatusOK, pair)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	var req refreshReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	_ = h.svc.Logout(r.Context(), req.RefreshToken)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if _, err := h.svc.ForgotPassword(r.Context(), req.Email); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not process request")
		return
	}
	// Always 202 to avoid leaking whether the email exists.
	httpx.JSON(w, http.StatusAccepted, map[string]string{"status": "if the email exists, a reset link was sent"})
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_token", "invalid or expired reset token")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "password updated"})
}

func (h *Handler) getMe(w http.ResponseWriter, r *http.Request) {
	claims := httpx.ClaimsFrom(r.Context())
	u, err := h.svc.GetProfile(r.Context(), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) {
	claims := httpx.ClaimsFrom(r.Context())
	var req updateProfileReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	u, err := h.svc.UpdateProfile(r.Context(), claims.UserID, req.FullName, req.Phone)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not update profile")
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) listAddresses(w http.ResponseWriter, r *http.Request) {
	claims := httpx.ClaimsFrom(r.Context())
	addrs, err := h.svc.ListAddresses(r.Context(), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not list addresses")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": addrs})
}

func (h *Handler) addAddress(w http.ResponseWriter, r *http.Request) {
	claims := httpx.ClaimsFrom(r.Context())
	var req addressReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	a := &domain.Address{
		UserID:    claims.UserID,
		Line1:     req.Line1,
		Line2:     req.Line2,
		City:      req.City,
		State:     req.State,
		Pincode:   req.Pincode,
		Country:   req.Country,
		IsDefault: req.IsDefault,
	}
	created, err := h.svc.AddAddress(r.Context(), a)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not add address")
		return
	}
	httpx.JSON(w, http.StatusCreated, created)
}

func (h *Handler) deleteAddress(w http.ResponseWriter, r *http.Request) {
	claims := httpx.ClaimsFrom(r.Context())
	id := chi.URLParam(r, "id")
	if err := h.svc.DeleteAddress(r.Context(), claims.UserID, id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "address not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not delete address")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	limit := parseIntDefault(r.URL.Query().Get("limit"), 20)
	offset := parseIntDefault(r.URL.Query().Get("offset"), 0)
	users, err := h.svc.ListUsers(r.Context(), limit, offset)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not list users")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": users})
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
