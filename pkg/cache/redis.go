// Package cache wraps a Redis client used for caching, refresh-token storage,
// rate limiting, and lightweight pub/sub eventing.
package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// New creates and verifies a Redis client from a redis:// URL.
func New(ctx context.Context, url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		return nil, err
	}
	return client, nil
}
