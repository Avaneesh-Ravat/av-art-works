// Package storage abstracts object storage for artwork images. Production uses
// S3 (presigned PUT uploads + CloudFront public URLs); local development uses a
// mock that returns predictable URLs so the flow can be exercised without AWS.
package storage

import (
	"context"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Presign describes a client-side upload target.
type Presign struct {
	Key       string `json:"key"`
	UploadURL string `json:"upload_url"`
	PublicURL string `json:"public_url"`
}

// Storage issues upload targets and resolves public URLs for stored objects.
type Storage interface {
	PresignUpload(filename, contentType string) (Presign, error)
	PublicURL(key string) string
	GetObject(ctx context.Context, key string) (Object, error)
}

// Object is a readable stored object.
type Object struct {
	Body        io.ReadCloser
	ContentType string
}

// NewKey builds a unique, namespaced object key from a filename.
func NewKey(prefix, filename string) string {
	ext := path.Ext(filename)
	return fmt.Sprintf("%s/%s%s", strings.Trim(prefix, "/"), uuid.NewString(), ext)
}

// Mock is a local, no-AWS implementation of Storage.
type Mock struct {
	BaseURL       string // e.g. http://localhost:8082/uploads
	PublicBaseURL string // e.g. /api/v1/media
}

// NewMock builds a mock storage backend.
func NewMock(baseURL, publicBaseURL string) *Mock {
	return &Mock{
		BaseURL:       strings.TrimRight(baseURL, "/"),
		PublicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}
}

// PresignUpload returns a fake upload URL valid for an hour.
func (m *Mock) PresignUpload(filename, _ string) (Presign, error) {
	key := NewKey("products", filename)
	return Presign{
		Key:       key,
		UploadURL: fmt.Sprintf("%s/%s?mock-expires=%d", m.BaseURL, key, time.Now().Add(time.Hour).Unix()),
		PublicURL: m.PublicURL(key),
	}, nil
}

// PublicURL resolves the publicly served URL for a key. If the key is already
// an absolute URL (e.g. an externally hosted image), it is returned unchanged.
func (m *Mock) PublicURL(key string) string {
	if key == "" {
		return ""
	}
	if isAbsoluteURL(key) {
		return key
	}
	if m.PublicBaseURL != "" {
		return fmt.Sprintf("%s/%s", m.PublicBaseURL, key)
	}
	return fmt.Sprintf("%s/%s", m.BaseURL, key)
}

// GetObject is not supported for the mock backend (objects are not persisted).
func (m *Mock) GetObject(_ context.Context, key string) (Object, error) {
	return Object{}, fmt.Errorf("object not found: %s", key)
}

// isAbsoluteURL reports whether key is already a fully-qualified http(s) URL.
func isAbsoluteURL(key string) bool {
	return strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://")
}
