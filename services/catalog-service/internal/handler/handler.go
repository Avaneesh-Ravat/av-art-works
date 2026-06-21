// Package handler exposes the catalog-service HTTP API.
package handler

import (
	"errors"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"avartworks/pkg/auth"
	"avartworks/pkg/httpx"
	"avartworks/services/catalog-service/docs"
	"avartworks/services/catalog-service/internal/domain"
	"avartworks/services/catalog-service/internal/service"
)

// Handler wires catalog routes to the service layer.
type Handler struct {
	svc           *service.Service
	auth          *auth.Manager
	internalToken string
}

// New constructs a Handler. internalToken guards service-to-service routes.
func New(svc *service.Service, a *auth.Manager, internalToken string) *Handler {
	return &Handler{svc: svc, auth: a, internalToken: internalToken}
}

// Routes mounts catalog routes.
func (h *Handler) Routes(corsOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(httpx.CORS(corsOrigins))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "catalog-service"})
	})
	httpx.MountSwagger(r, docs.OpenAPISpec)

	// Public media (product images) — path prefix avoids chi wildcard quirks in nested groups.
	r.HandleFunc("/api/v1/media/*", h.serveMedia)

	r.Route("/api/v1", func(r chi.Router) {
		// Public reads.
		r.Get("/products", h.listProducts)
		r.Get("/products/{slug}", h.getProduct)
		r.Get("/categories", h.listCategories)
		r.Get("/site-profile", h.getSiteProfile)

		// Admin writes.
		r.Group(func(r chi.Router) {
			r.Use(httpx.RequireAuth(h.auth), httpx.RequireAdmin)
			r.Post("/products", h.createProduct)
			r.Put("/products/{id}", h.updateProduct)
			r.Delete("/products/{id}", h.deleteProduct)
			r.Patch("/products/{id}/inventory", h.setInventory)
			r.Post("/products/{id}/images", h.addImage)
			r.Post("/products/{id}/images/batch", h.addImagesBatch)
			r.Post("/uploads/presign", h.presign)
			r.Put("/site-profile", h.updateSiteProfile)
			r.Patch("/site-profile/about", h.updateAboutSection)
			r.Post("/categories", h.createCategory)
			r.Put("/categories/{id}", h.updateCategory)
			r.Delete("/categories/{id}", h.deleteCategory)
		})
	})

	// Internal service-to-service routes (guarded by a shared token).
	r.Route("/internal", func(r chi.Router) {
		r.Use(h.requireInternal)
		r.Get("/products/{id}", h.getProductByID)
		r.Post("/products/{id}/reserve", h.reserve)
		r.Post("/products/{id}/release", h.release)
		r.Post("/products/{id}/commit", h.commit)
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

type productReq struct {
	CategoryID  string  `json:"category_id"`
	Title       string  `json:"title" validate:"required"`
	Description string  `json:"description"`
	Price       float64 `json:"price" validate:"required,gt=0"`
	Medium      string  `json:"medium" validate:"required"`
	IsActive    *bool   `json:"is_active"`
	Stock       int     `json:"stock" validate:"gte=0"`
}

func (req productReq) toInput() service.ProductInput {
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	return service.ProductInput{
		CategoryID:  req.CategoryID,
		Title:       req.Title,
		Description: req.Description,
		PricePaise:  int64(math.Round(req.Price * 100)),
		Medium:      req.Medium,
		IsActive:    active,
		Stock:       req.Stock,
	}
}

type inventoryReq struct {
	Quantity int `json:"quantity" validate:"gte=0"`
}

type imageReq struct {
	S3Key     string `json:"s3_key" validate:"required"`
	SortOrder int    `json:"sort_order"`
}

type imagesBatchReq struct {
	S3Keys []string `json:"s3_keys" validate:"required,min=1,dive,required"`
}

type presignReq struct {
	Filename    string `json:"filename" validate:"required"`
	ContentType string `json:"content_type"`
}

type categoryReq struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
}

type siteProfileReq struct {
	SiteName        string               `json:"site_name" validate:"required"`
	FooterTagline   string               `json:"footer_tagline"`
	HeroTagline     string               `json:"hero_tagline"`
	HeroTitle       string               `json:"hero_title" validate:"required"`
	HeroDescription string               `json:"hero_description"`
	Email           string               `json:"email"`
	Phone           string               `json:"phone"`
	Location        string               `json:"location"`
	InstagramURL    string               `json:"instagram_url"`
	FacebookURL     string               `json:"facebook_url"`
	PinterestURL    string               `json:"pinterest_url"`
	Testimonials    []domain.Testimonial `json:"testimonials"`
}

type aboutSectionReq struct {
	AboutTitle      string  `json:"about_title" validate:"required"`
	AboutText       string  `json:"about_text"`
	AboutImageS3Key *string `json:"about_image_s3_key"`
}

type qtyReq struct {
	Qty int `json:"qty" validate:"required,gt=0"`
}

// ---- Public handlers ----

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	query := domain.ProductQuery{
		Search:     q.Get("q"),
		CategoryID: h.svc.ResolveCategory(r.Context(), q.Get("category")),
		Medium:     q.Get("medium"),
		Sort:       q.Get("sort"),
		Page:       parseIntDefault(q.Get("page"), 1),
		Limit:      parseIntDefault(q.Get("limit"), 12),
	}
	page, err := h.svc.ListProducts(r.Context(), query)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not list products")
		return
	}
	httpx.JSON(w, http.StatusOK, page)
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.GetProductBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) listCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.svc.ListCategories(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not list categories")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": cats})
}

func (h *Handler) getSiteProfile(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.GetSiteProfile(r.Context())
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "site profile not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not load site profile")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) serveMedia(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimPrefix(r.URL.Path, "/api/v1/media/")
	if key == "" || strings.Contains(key, "..") {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", "invalid media path")
		return
	}
	obj, err := h.svc.GetMedia(r.Context(), key)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "media not found")
		return
	}
	defer obj.Body.Close()
	if obj.ContentType != "" {
		w.Header().Set("Content-Type", obj.ContentType)
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, obj.Body)
}

// ---- Admin handlers ----

func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	var req productReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	p, err := h.svc.CreateProduct(r.Context(), req.toInput())
	if err != nil {
		h.writeProductErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}

func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	var req productReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	p, err := h.svc.UpdateProduct(r.Context(), chi.URLParam(r, "id"), req.toInput())
	if err != nil {
		h.writeProductErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) deleteProduct(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteProduct(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "product not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not delete product")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) setInventory(w http.ResponseWriter, r *http.Request) {
	var req inventoryReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.SetInventory(r.Context(), chi.URLParam(r, "id"), req.Quantity); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not set inventory")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"status": "ok", "quantity": req.Quantity})
}

func (h *Handler) presign(w http.ResponseWriter, r *http.Request) {
	var req presignReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	p, err := h.svc.PresignUpload(req.Filename, req.ContentType)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not presign upload")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) addImage(w http.ResponseWriter, r *http.Request) {
	var req imageReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	img, err := h.svc.AddImage(r.Context(), chi.URLParam(r, "id"), req.S3Key, req.SortOrder)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not add image")
		return
	}
	httpx.JSON(w, http.StatusCreated, img)
}

func (h *Handler) addImagesBatch(w http.ResponseWriter, r *http.Request) {
	var req imagesBatchReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	images, err := h.svc.AddImages(r.Context(), chi.URLParam(r, "id"), req.S3Keys)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not add images")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"items": images})
}

func (h *Handler) updateSiteProfile(w http.ResponseWriter, r *http.Request) {
	var req siteProfileReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	p := &domain.SiteProfile{
		SiteName:        req.SiteName,
		FooterTagline:   req.FooterTagline,
		HeroTagline:     req.HeroTagline,
		HeroTitle:       req.HeroTitle,
		HeroDescription: req.HeroDescription,
		Email:           req.Email,
		Phone:           req.Phone,
		Location:        req.Location,
		InstagramURL:    req.InstagramURL,
		FacebookURL:     req.FacebookURL,
		PinterestURL:    req.PinterestURL,
		Testimonials:    req.Testimonials,
	}
	updated, err := h.svc.UpdateSiteProfile(r.Context(), p)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "site profile not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not update site profile")
		return
	}
	httpx.JSON(w, http.StatusOK, updated)
}

func (h *Handler) updateAboutSection(w http.ResponseWriter, r *http.Request) {
	var req aboutSectionReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	updated, err := h.svc.UpdateAboutSection(r.Context(), req.AboutTitle, req.AboutText, req.AboutImageS3Key)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "site profile not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not update about section")
		return
	}
	httpx.JSON(w, http.StatusOK, updated)
}

func (h *Handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var req categoryReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	c, err := h.svc.CreateCategory(r.Context(), req.Name, req.Description)
	if err != nil {
		if errors.Is(err, domain.ErrSlugExists) {
			httpx.Error(w, http.StatusConflict, "slug_exists", "a category with this name already exists")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not create category")
		return
	}
	httpx.JSON(w, http.StatusCreated, c)
}

func (h *Handler) updateCategory(w http.ResponseWriter, r *http.Request) {
	var req categoryReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.UpdateCategory(r.Context(), chi.URLParam(r, "id"), req.Name, req.Description); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not update category")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) deleteCategory(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteCategory(r.Context(), chi.URLParam(r, "id")); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not delete category")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- Internal handlers ----

func (h *Handler) getProductByID(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.GetProductByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "not_found", "product not found")
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) reserve(w http.ResponseWriter, r *http.Request) {
	var req qtyReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.Reserve(r.Context(), chi.URLParam(r, "id"), req.Qty); err != nil {
		if errors.Is(err, domain.ErrOutOfStock) {
			httpx.Error(w, http.StatusConflict, "out_of_stock", "insufficient stock")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not reserve")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "reserved"})
}

func (h *Handler) release(w http.ResponseWriter, r *http.Request) {
	var req qtyReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.Release(r.Context(), chi.URLParam(r, "id"), req.Qty); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not release")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "released"})
}

func (h *Handler) commit(w http.ResponseWriter, r *http.Request) {
	var req qtyReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if err := h.svc.Commit(r.Context(), chi.URLParam(r, "id"), req.Qty); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not commit")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "committed"})
}

func (h *Handler) writeProductErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidMedium):
		httpx.Error(w, http.StatusBadRequest, "invalid_medium", "medium must be one of resin, texture, acrylic, custom, handmade")
	case errors.Is(err, domain.ErrSlugExists):
		httpx.Error(w, http.StatusConflict, "slug_exists", "a product with this title already exists")
	case errors.Is(err, domain.ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "not_found", "product not found")
	default:
		httpx.Error(w, http.StatusInternalServerError, "internal", "could not save product")
	}
}

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
