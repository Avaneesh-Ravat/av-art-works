// Package domain holds the catalog-service entities and errors.
package domain

import (
	"errors"
	"time"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrSlugExists    = errors.New("slug already exists")
	ErrOutOfStock    = errors.New("insufficient stock")
	ErrInvalidMedium = errors.New("invalid medium")
)

// ValidMediums lists the allowed artwork mediums.
var ValidMediums = map[string]bool{
	"resin": true, "texture": true, "acrylic": true, "custom": true, "handmade": true,
}

// Category groups products.
type Category struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Image is a product image.
type Image struct {
	ID        string `json:"id"`
	S3Key     string `json:"-"`
	URL       string `json:"url"`
	SortOrder int    `json:"sort_order"`
}

// Product is an artwork listing. Money is stored in paise (integer) to avoid
// floating-point errors; Price is the rupee representation for convenience.
type Product struct {
	ID          string    `json:"id"`
	CategoryID  string    `json:"category_id,omitempty"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	PricePaise  int64     `json:"price_paise"`
	Price       float64   `json:"price"`
	Medium      string    `json:"medium"`
	IsActive    bool      `json:"is_active"`
	Stock       int       `json:"stock"`
	Images      []Image   `json:"images,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// SetPriceFromPaise keeps the rupee field in sync with paise.
func (p *Product) SetPriceFromPaise() { p.Price = float64(p.PricePaise) / 100 }

// ProductQuery captures listing filters.
type ProductQuery struct {
	Search     string
	CategoryID string
	Medium     string
	Sort       string // newest | price_asc | price_desc | title
	Page       int
	Limit      int
}

// Page is a paginated result wrapper.
type Page[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

// Testimonial is a customer quote shown on the landing page.
type Testimonial struct {
	Name string `json:"name"`
	Text string `json:"text"`
}

// SiteProfile holds editable public site content (singleton row).
type SiteProfile struct {
	SiteName        string        `json:"site_name"`
	FooterTagline   string        `json:"footer_tagline"`
	HeroTagline     string        `json:"hero_tagline"`
	HeroTitle       string        `json:"hero_title"`
	HeroDescription string        `json:"hero_description"`
	AboutTitle      string        `json:"about_title"`
	AboutText       string        `json:"about_text"`
	AboutImageS3Key string        `json:"about_image_s3_key,omitempty"`
	AboutImageURL   string        `json:"about_image_url,omitempty"`
	Email           string        `json:"email"`
	Phone           string        `json:"phone"`
	Location        string        `json:"location"`
	InstagramURL    string        `json:"instagram_url"`
	FacebookURL     string        `json:"facebook_url"`
	PinterestURL    string        `json:"pinterest_url"`
	Testimonials    []Testimonial `json:"testimonials"`
	UpdatedAt       time.Time     `json:"updated_at"`
}
