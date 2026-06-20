// Command server runs the AV Art Works API Gateway: the single public entry
// point that routes to the backend microservices, enforces auth and rate
// limiting, and applies CORS.
package main

import (
	"context"
	"strings"
	"time"

	"avartworks/pkg/auth"
	"avartworks/pkg/cache"
	"avartworks/pkg/config"
	"avartworks/pkg/httpx"
	"avartworks/pkg/logger"
	"avartworks/services/gateway/internal/gateway"
)

func main() {
	log := logger.New("gateway")
	ctx := context.Background()

	tokens := auth.NewManager(
		config.Get("JWT_SECRET", "local-dev-secret-change-me"),
		config.GetDuration("JWT_ACCESS_TTL", 15*time.Minute),
		config.GetDuration("JWT_REFRESH_TTL", 168*time.Hour),
	)

	// Redis is used for rate limiting; the gateway still works without it.
	rdb, err := cache.New(ctx, config.Get("REDIS_URL", "redis://localhost:6379/0"))
	if err != nil {
		log.Warn("redis unavailable; rate limiting disabled", "err", err)
		rdb = nil
	}

	opts := gateway.Options{
		Backends: gateway.Backends{
			User:    config.Get("USER_SERVICE_URL", "http://localhost:8081"),
			Catalog: config.Get("CATALOG_SERVICE_URL", "http://localhost:8082"),
			Order:   config.Get("ORDER_SERVICE_URL", "http://localhost:8083"),
			Payment: config.Get("PAYMENT_SERVICE_URL", "http://localhost:8084"),
		},
		Tokens:      tokens,
		Redis:       rdb,
		CORSOrigins: strings.Split(config.Get("CORS_ALLOWED_ORIGINS", "*"), ","),
		RateLimit:   config.GetInt("RATE_LIMIT", 120),
		RateWindow:  config.GetDuration("RATE_WINDOW", time.Minute),
	}

	h, err := gateway.Handler(opts)
	if err != nil {
		log.Error("build gateway", "err", err)
		return
	}

	addr := config.Get("HTTP_ADDR", ":8080")
	if err := httpx.RunServer(addr, h, log); err != nil {
		log.Error("server error", "err", err)
	}
}
