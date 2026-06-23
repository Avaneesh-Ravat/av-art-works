// Package repository implements PostgreSQL persistence for the user service.
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"avartworks/services/user-service/internal/domain"
)

// Repository provides data access for users and addresses.
type Repository struct {
	pool *pgxpool.Pool
}

// New constructs a Repository.
func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// CreateUser inserts a new user and returns it.
func (r *Repository) CreateUser(ctx context.Context, u *domain.User) (*domain.User, error) {
	const q = `
		INSERT INTO users (email, password_hash, full_name, phone, role)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`
	err := r.pool.QueryRow(ctx, q, u.Email, u.PasswordHash, u.FullName, u.Phone, u.Role).
		Scan(&u.ID, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, domain.ErrEmailExists
		}
		return nil, err
	}
	return u, nil
}

// GetUserByEmail looks up a user by email (includes password hash).
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	const q = `
		SELECT id, email, password_hash, full_name, COALESCE(phone,''), role, created_at
		FROM users WHERE email = $1`
	var u domain.User
	err := r.pool.QueryRow(ctx, q, email).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Phone, &u.Role, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &u, err
}

// GetUserByID looks up a user by id.
func (r *Repository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	const q = `
		SELECT id, email, password_hash, full_name, COALESCE(phone,''), role, created_at
		FROM users WHERE id = $1`
	var u domain.User
	err := r.pool.QueryRow(ctx, q, id).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Phone, &u.Role, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &u, err
}

// UpdateProfile updates a user's full name and phone.
func (r *Repository) UpdateProfile(ctx context.Context, id, fullName, phone string) (*domain.User, error) {
	const q = `
		UPDATE users SET full_name = $2, phone = $3, updated_at = now()
		WHERE id = $1
		RETURNING id, email, COALESCE(phone,''), full_name, role, created_at`
	var u domain.User
	err := r.pool.QueryRow(ctx, q, id, fullName, phone).
		Scan(&u.ID, &u.Email, &u.Phone, &u.FullName, &u.Role, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &u, err
}

// UpdatePassword sets a new password hash for a user.
func (r *Repository) UpdatePassword(ctx context.Context, id, hash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1`, id, hash)
	return err
}

// ListUsers returns all users (admin), newest first.
func (r *Repository) ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error) {
	const q = `
		SELECT id, email, COALESCE(phone,''), full_name, role, created_at
		FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	rows, err := r.pool.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []domain.User
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Phone, &u.FullName, &u.Role, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// CreateAddress inserts a new address; if marked default, unsets others.
func (r *Repository) CreateAddress(ctx context.Context, a *domain.Address) (*domain.Address, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if a.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default=false WHERE user_id=$1`, a.UserID); err != nil {
			return nil, err
		}
	}
	const q = `
		INSERT INTO addresses (user_id, line1, line2, locality, city, state, pincode, country, is_default)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, created_at`
	err = tx.QueryRow(ctx, q, a.UserID, a.Line1, a.Line2, a.Locality, a.City, a.State, a.Pincode, a.Country, a.IsDefault).
		Scan(&a.ID, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return a, tx.Commit(ctx)
}

// ListAddresses returns a user's addresses.
func (r *Repository) ListAddresses(ctx context.Context, userID string) ([]domain.Address, error) {
	const q = `
		SELECT id, user_id, line1, COALESCE(line2,''), COALESCE(locality,''), city, state, pincode, country, is_default, created_at
		FROM addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC`
	rows, err := r.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Address
	for rows.Next() {
		var a domain.Address
		if err := rows.Scan(&a.ID, &a.UserID, &a.Line1, &a.Line2, &a.Locality, &a.City, &a.State, &a.Pincode, &a.Country, &a.IsDefault, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// DeleteAddress removes an address owned by the user.
func (r *Repository) DeleteAddress(ctx context.Context, userID, addressID string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM addresses WHERE id=$1 AND user_id=$2`, addressID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
