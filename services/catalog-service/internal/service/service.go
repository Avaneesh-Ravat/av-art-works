// Package service contains the catalog-service business logic: product and
// category management, search, inventory, and image handling. Product detail
// reads are cached in Redis with a short TTL.
package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"avartworks/pkg/storage"
	"avartworks/services/catalog-service/internal/domain"
	"avartworks/services/catalog-service/internal/repository"
)

const productCacheTTL = 60 * time.Second

// Service holds catalog dependencies.
type Service struct {
	repo  *repository.Repository
	rdb   *redis.Client
	store storage.Storage
	log   *slog.Logger
}

// New constructs the catalog Service.
func New(repo *repository.Repository, rdb *redis.Client, store storage.Storage, log *slog.Logger) *Service {
	return &Service{repo: repo, rdb: rdb, store: store, log: log}
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

// Slugify converts a title into a URL-safe slug.
func Slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugRe.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func (s *Service) resolveImageURLs(p *domain.Product) {
	for i := range p.Images {
		p.Images[i].URL = s.store.PublicURL(p.Images[i].S3Key)
	}
}

// ListProducts returns a paginated product listing.
func (s *Service) ListProducts(ctx context.Context, q domain.ProductQuery) (*domain.Page[domain.Product], error) {
	items, total, err := s.repo.ListProducts(ctx, q)
	if err != nil {
		return nil, err
	}
	for i := range items {
		s.resolveImageURLs(&items[i])
	}
	page := q.Page
	if page < 1 {
		page = 1
	}
	limit := q.Limit
	if limit <= 0 || limit > 100 {
		limit = 12
	}
	return &domain.Page[domain.Product]{Items: items, Total: total, Page: page, Limit: limit}, nil
}

// GetProductBySlug returns a product detail, using a short-lived cache.
func (s *Service) GetProductBySlug(ctx context.Context, slug string) (*domain.Product, error) {
	cacheKey := "catalog:product:" + slug
	if cached, err := s.rdb.Get(ctx, cacheKey).Bytes(); err == nil {
		var p domain.Product
		if json.Unmarshal(cached, &p) == nil {
			return &p, nil
		}
	}
	p, err := s.repo.GetProductBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	s.resolveImageURLs(p)
	if raw, err := json.Marshal(p); err == nil {
		s.rdb.Set(ctx, cacheKey, raw, productCacheTTL)
	}
	return p, nil
}

// GetProductByID returns a product detail by id (used internally).
func (s *Service) GetProductByID(ctx context.Context, id string) (*domain.Product, error) {
	p, err := s.repo.GetProductByID(ctx, id)
	if err != nil {
		return nil, err
	}
	s.resolveImageURLs(p)
	return p, nil
}

// ProductInput is the create/update payload.
type ProductInput struct {
	CategoryID  string
	Title       string
	Description string
	PricePaise  int64
	Medium      string
	IsActive    bool
	Stock       int
}

// CreateProduct creates a new product with inventory.
func (s *Service) CreateProduct(ctx context.Context, in ProductInput) (*domain.Product, error) {
	if !domain.ValidMediums[in.Medium] {
		return nil, domain.ErrInvalidMedium
	}
	p := &domain.Product{
		CategoryID:  in.CategoryID,
		Title:       in.Title,
		Slug:        Slugify(in.Title),
		Description: in.Description,
		PricePaise:  in.PricePaise,
		Medium:      in.Medium,
		IsActive:    in.IsActive,
	}
	return s.repo.CreateProduct(ctx, p, in.Stock)
}

// UpdateProduct updates an existing product.
func (s *Service) UpdateProduct(ctx context.Context, id string, in ProductInput) (*domain.Product, error) {
	if !domain.ValidMediums[in.Medium] {
		return nil, domain.ErrInvalidMedium
	}
	existing, err := s.repo.GetProductByID(ctx, id)
	if err != nil {
		return nil, err
	}
	p := &domain.Product{
		ID:          id,
		CategoryID:  in.CategoryID,
		Title:       in.Title,
		Slug:        Slugify(in.Title),
		Description: in.Description,
		PricePaise:  in.PricePaise,
		Medium:      in.Medium,
		IsActive:    in.IsActive,
	}
	updated, err := s.repo.UpdateProduct(ctx, p)
	if err != nil {
		return nil, err
	}
	s.rdb.Del(ctx, "catalog:product:"+existing.Slug, "catalog:product:"+updated.Slug)
	s.resolveImageURLs(updated)
	return updated, nil
}

// DeleteProduct removes a product and invalidates its cache.
func (s *Service) DeleteProduct(ctx context.Context, id string) error {
	if p, err := s.repo.GetProductByID(ctx, id); err == nil {
		s.rdb.Del(ctx, "catalog:product:"+p.Slug)
	}
	return s.repo.DeleteProduct(ctx, id)
}

// SetInventory sets absolute stock for a product.
func (s *Service) SetInventory(ctx context.Context, productID string, quantity int) error {
	return s.repo.SetInventory(ctx, productID, quantity)
}

// PresignUpload returns an upload target for a product image.
func (s *Service) PresignUpload(filename, contentType string) (storage.Presign, error) {
	return s.store.PresignUpload(filename, contentType)
}

// GetMedia streams a stored object for public read (via the /media/* route).
func (s *Service) GetMedia(ctx context.Context, key string) (storage.Object, error) {
	if isAbsoluteURL(key) {
		return storage.Object{}, domain.ErrNotFound
	}
	return s.store.GetObject(ctx, key)
}

func isAbsoluteURL(key string) bool {
	return strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://")
}

// AddImage registers an uploaded image against a product.
func (s *Service) AddImage(ctx context.Context, productID, s3Key string, sortOrder int) (*domain.Image, error) {
	img, err := s.repo.AddImage(ctx, productID, s3Key, sortOrder)
	if err != nil {
		return nil, err
	}
	if p, err := s.repo.GetProductByID(ctx, productID); err == nil {
		s.rdb.Del(ctx, "catalog:product:"+p.Slug)
	}
	img.URL = s.store.PublicURL(img.S3Key)
	return img, nil
}

// AddImages registers multiple uploaded images against a product in one transaction.
func (s *Service) AddImages(ctx context.Context, productID string, keys []string) ([]domain.Image, error) {
	images, err := s.repo.AddImages(ctx, productID, keys)
	if err != nil {
		return nil, err
	}
	if p, err := s.repo.GetProductByID(ctx, productID); err == nil {
		s.rdb.Del(ctx, "catalog:product:"+p.Slug)
	}
	for i := range images {
		images[i].URL = s.store.PublicURL(images[i].S3Key)
	}
	return images, nil
}

// Reserve, Release, Commit proxy inventory operations for the order service.
func (s *Service) Reserve(ctx context.Context, productID string, qty int) error {
	return s.repo.Reserve(ctx, productID, qty)
}
func (s *Service) Release(ctx context.Context, productID string, qty int) error {
	return s.repo.Release(ctx, productID, qty)
}
func (s *Service) Commit(ctx context.Context, productID string, qty int) error {
	return s.repo.Commit(ctx, productID, qty)
}

// ---- Categories ----

// ListCategories returns all categories.
func (s *Service) ListCategories(ctx context.Context) ([]domain.Category, error) {
	return s.repo.ListCategories(ctx)
}

// CreateCategory creates a category (slug derived from name).
func (s *Service) CreateCategory(ctx context.Context, name, description string) (*domain.Category, error) {
	c := &domain.Category{Name: name, Slug: Slugify(name), Description: description}
	return s.repo.CreateCategory(ctx, c)
}

// UpdateCategory updates a category.
func (s *Service) UpdateCategory(ctx context.Context, id, name, description string) error {
	return s.repo.UpdateCategory(ctx, &domain.Category{ID: id, Name: name, Slug: Slugify(name), Description: description})
}

// DeleteCategory removes a category.
func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	return s.repo.DeleteCategory(ctx, id)
}

// ResolveCategory resolves a category slug or id to an id for filtering.
func (s *Service) ResolveCategory(ctx context.Context, slugOrID string) string {
	if slugOrID == "" {
		return ""
	}
	if id, _ := s.repo.CategoryIDBySlug(ctx, slugOrID); id != "" {
		return id
	}
	return slugOrID // assume it's already an id
}

// GetSiteProfile returns public site content with resolved image URLs.
func (s *Service) GetSiteProfile(ctx context.Context) (*domain.SiteProfile, error) {
	p, err := s.repo.GetSiteProfile(ctx)
	if err != nil {
		return nil, err
	}
	s.resolveSiteProfileURLs(p)
	return p, nil
}

// UpdateSiteProfile replaces editable site content (about section is updated separately).
func (s *Service) UpdateSiteProfile(ctx context.Context, p *domain.SiteProfile) (*domain.SiteProfile, error) {
	if _, err := s.repo.UpdateSiteProfile(ctx, p); err != nil {
		return nil, err
	}
	return s.GetSiteProfile(ctx)
}

func (s *Service) resolveSiteProfileURLs(p *domain.SiteProfile) {
	if p.AboutImageS3Key != "" {
		p.AboutImageURL = s.store.PublicURL(p.AboutImageS3Key)
	}
}

// UpdateAboutSection updates the home page "About the artist" section.
// When imageKey is nil the existing image is kept; an empty string removes it.
func (s *Service) UpdateAboutSection(ctx context.Context, title, text string, imageKey *string) (*domain.SiteProfile, error) {
	key := ""
	if imageKey != nil {
		key = *imageKey
	} else {
		current, err := s.repo.GetSiteProfile(ctx)
		if err != nil {
			return nil, err
		}
		key = current.AboutImageS3Key
	}
	p, err := s.repo.UpdateAboutSection(ctx, title, text, key)
	if err != nil {
		return nil, err
	}
	s.resolveSiteProfileURLs(p)
	return p, nil
}
