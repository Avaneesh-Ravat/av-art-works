// Package domain holds the core entities and errors for the user service.
package domain

import (
	"errors"
	"time"
)

// Domain-level errors mapped to HTTP statuses in the handler layer.
var (
	ErrNotFound       = errors.New("not found")
	ErrEmailExists    = errors.New("email already registered")
	ErrInvalidCreds   = errors.New("invalid credentials")
	ErrInvalidToken   = errors.New("invalid or expired token")
	ErrInvalidAddress = errors.New("invalid address")
)

// User is a registered account.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"full_name"`
	Phone     string    `json:"phone,omitempty"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	// PasswordHash is never serialized to clients.
	PasswordHash string `json:"-"`
}

// Address is a shipping address owned by a user.
type Address struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Line1     string    `json:"line1"`
	Line2     string    `json:"line2,omitempty"`
	Locality  string    `json:"locality"`
	City      string    `json:"city"`
	State     string    `json:"state"`
	Pincode   string    `json:"pincode"`
	Country   string    `json:"country"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
}
