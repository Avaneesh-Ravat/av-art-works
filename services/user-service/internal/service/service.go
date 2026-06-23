// Package service contains the user-service business logic: authentication,
// profile and address management. Refresh tokens and password-reset tokens
// are tracked in Redis so they can be expired and revoked.
package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"avartworks/pkg/auth"
	"avartworks/pkg/pincode"
	"avartworks/services/user-service/internal/domain"
	"avartworks/services/user-service/internal/repository"
)

// Service holds dependencies for user business logic.
type Service struct {
	repo    *repository.Repository
	tokens  *auth.Manager
	rdb     *redis.Client
	pincode *pincode.Client
	log     *slog.Logger
}

// New constructs the user Service.
func New(repo *repository.Repository, tokens *auth.Manager, rdb *redis.Client, log *slog.Logger) *Service {
	return &Service{repo: repo, tokens: tokens, rdb: rdb, pincode: pincode.NewClient(), log: log}
}

// TokenPair bundles an access and refresh token.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// Register creates a new (non-admin) user.
func (s *Service) Register(ctx context.Context, email, password, fullName, phone string) (*domain.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}
	u := &domain.User{
		Email:        strings.ToLower(strings.TrimSpace(email)),
		PasswordHash: string(hash),
		FullName:     fullName,
		Phone:        phone,
		Role:         string(auth.RoleUser),
	}
	return s.repo.CreateUser(ctx, u)
}

// Login verifies credentials and issues a token pair.
func (s *Service) Login(ctx context.Context, email, password string) (*TokenPair, *domain.User, error) {
	u, err := s.repo.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		if err == domain.ErrNotFound {
			return nil, nil, domain.ErrInvalidCreds
		}
		return nil, nil, err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return nil, nil, domain.ErrInvalidCreds
	}
	pair, err := s.issueTokens(ctx, u)
	if err != nil {
		return nil, nil, err
	}
	return pair, u, nil
}

func (s *Service) issueTokens(ctx context.Context, u *domain.User) (*TokenPair, error) {
	access, err := s.tokens.GenerateAccess(u.ID, u.Email, auth.Role(u.Role))
	if err != nil {
		return nil, err
	}
	refresh, jti, err := s.tokens.GenerateRefresh(u.ID)
	if err != nil {
		return nil, err
	}
	// Track refresh token server-side for revocation.
	if err := s.rdb.Set(ctx, refreshKey(jti), u.ID, s.tokens.RefreshTTL()).Err(); err != nil {
		return nil, err
	}
	return &TokenPair{AccessToken: access, RefreshToken: refresh}, nil
}

// Refresh validates a refresh token, rotates it, and returns a new pair.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims, err := s.tokens.ParseRefresh(refreshToken)
	if err != nil {
		return nil, domain.ErrInvalidToken
	}
	// The jti must still exist in Redis (not revoked / not expired).
	userID, err := s.rdb.Get(ctx, refreshKey(claims.ID)).Result()
	if err != nil {
		return nil, domain.ErrInvalidToken
	}
	// Rotate: invalidate the old token.
	s.rdb.Del(ctx, refreshKey(claims.ID))

	u, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, domain.ErrInvalidToken
	}
	return s.issueTokens(ctx, u)
}

// Logout revokes a refresh token.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	claims, err := s.tokens.ParseRefresh(refreshToken)
	if err != nil {
		return nil
	}
	return s.rdb.Del(ctx, refreshKey(claims.ID)).Err()
}

// ForgotPassword generates a reset token. In production this is emailed; for
// the MVP we store it in Redis and return/log it (mock email).
func (s *Service) ForgotPassword(ctx context.Context, email string) (string, error) {
	u, err := s.repo.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		// Do not reveal whether the email exists.
		return "", nil
	}
	token := randomToken()
	if err := s.rdb.Set(ctx, resetKey(token), u.ID, time.Hour).Err(); err != nil {
		return "", err
	}
	s.log.Info("password reset requested (mock email)", "email", email, "reset_token", token)
	return token, nil
}

// ResetPassword consumes a reset token and sets a new password.
func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	userID, err := s.rdb.Get(ctx, resetKey(token)).Result()
	if err != nil {
		return domain.ErrInvalidToken
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}
	if err := s.repo.UpdatePassword(ctx, userID, string(hash)); err != nil {
		return err
	}
	s.rdb.Del(ctx, resetKey(token))
	return nil
}

// GetProfile returns a user's public profile.
func (s *Service) GetProfile(ctx context.Context, userID string) (*domain.User, error) {
	return s.repo.GetUserByID(ctx, userID)
}

// UpdateProfile updates name and phone.
func (s *Service) UpdateProfile(ctx context.Context, userID, fullName, phone string) (*domain.User, error) {
	return s.repo.UpdateProfile(ctx, userID, fullName, phone)
}

// ListUsers returns users for admins.
func (s *Service) ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error) {
	return s.repo.ListUsers(ctx, limit, offset)
}

// LookupPincode returns city, state, and localities for an Indian pincode.
func (s *Service) LookupPincode(ctx context.Context, pincodeValue string) (*pincode.Result, error) {
	pincodeValue = strings.TrimSpace(pincodeValue)
	if !pincode.ValidFormat(pincodeValue) {
		return nil, pincode.ErrInvalidFormat
	}

	cacheKey := "pincode:" + pincodeValue
	if cached, err := s.rdb.Get(ctx, cacheKey).Bytes(); err == nil {
		var result pincode.Result
		if json.Unmarshal(cached, &result) == nil {
			return &result, nil
		}
	}

	result, err := s.pincode.Lookup(ctx, pincodeValue)
	if err != nil {
		return nil, err
	}

	if encoded, err := json.Marshal(result); err == nil {
		_ = s.rdb.Set(ctx, cacheKey, encoded, 30*24*time.Hour).Err()
	}
	return result, nil
}

// AddAddress adds a shipping address after pincode verification.
func (s *Service) AddAddress(ctx context.Context, a *domain.Address) (*domain.Address, error) {
	if err := s.validateAddress(ctx, a); err != nil {
		return nil, err
	}
	return s.repo.CreateAddress(ctx, a)
}

// ListAddresses lists a user's addresses.
func (s *Service) ListAddresses(ctx context.Context, userID string) ([]domain.Address, error) {
	return s.repo.ListAddresses(ctx, userID)
}

// DeleteAddress removes an address.
func (s *Service) DeleteAddress(ctx context.Context, userID, addressID string) error {
	return s.repo.DeleteAddress(ctx, userID, addressID)
}

// EnsureAdmin creates or promotes an admin account at startup if configured.
func (s *Service) EnsureAdmin(ctx context.Context, email, password string) error {
	if email == "" || password == "" {
		return nil
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if _, err := s.repo.GetUserByEmail(ctx, email); err == nil {
		return nil // already exists
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	_, err = s.repo.CreateUser(ctx, &domain.User{
		Email:        email,
		PasswordHash: string(hash),
		FullName:     "Administrator",
		Role:         string(auth.RoleAdmin),
	})
	if err == nil {
		s.log.Info("seeded admin user", "email", email)
	}
	return err
}

func refreshKey(jti string) string { return "refresh:" + jti }
func resetKey(token string) string { return "reset:" + token }

func (s *Service) validateAddress(ctx context.Context, a *domain.Address) error {
	if strings.TrimSpace(a.Line1) == "" || strings.TrimSpace(a.Locality) == "" ||
		strings.TrimSpace(a.City) == "" || strings.TrimSpace(a.State) == "" ||
		strings.TrimSpace(a.Pincode) == "" {
		return domain.ErrInvalidAddress
	}
	if a.Country == "" {
		a.Country = "India"
	}
	if a.Country != "India" {
		return domain.ErrInvalidAddress
	}

	result, err := s.LookupPincode(ctx, a.Pincode)
	if err != nil {
		if errors.Is(err, pincode.ErrInvalidFormat) || errors.Is(err, pincode.ErrNotFound) {
			return domain.ErrInvalidAddress
		}
		return err
	}
	if !pincode.Matches(result, a.City, a.State, a.Locality) {
		return domain.ErrInvalidAddress
	}
	// Store canonical values from the postal API.
	a.City = result.City
	a.State = result.State
	return nil
}

func randomToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
