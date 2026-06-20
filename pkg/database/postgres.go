// Package database provides a shared PostgreSQL connection pool and a
// migration runner. All four services connect to the same RDS instance but
// use a dedicated schema (search_path) per service for logical isolation.
package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Config describes a Postgres connection target.
type Config struct {
	URL    string // e.g. postgres://user:pass@host:5432/db?sslmode=disable
	Schema string // per-service schema, set as search_path
}

// NewPool creates a pgx connection pool, ensures the service schema exists,
// and pins the connection search_path to that schema.
func NewPool(ctx context.Context, cfg Config) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse db url: %w", err)
	}
	poolCfg.MaxConns = 10
	poolCfg.MaxConnLifetime = time.Hour

	if cfg.Schema != "" {
		// Run on every new connection so every query targets the service schema.
		poolCfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
			_, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", cfg.Schema))
			return err
		}
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if cfg.Schema != "" {
		if _, err := pool.Exec(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", cfg.Schema)); err != nil {
			pool.Close()
			return nil, fmt.Errorf("create schema: %w", err)
		}
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return pool, nil
}
