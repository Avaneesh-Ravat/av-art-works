// Command server runs the AV Art Works User Service.
package main

import (
	"context"
	"strings"
	"time"

	"avartworks/pkg/auth"
	"avartworks/pkg/cache"
	"avartworks/pkg/config"
	"avartworks/pkg/database"
	"avartworks/pkg/httpx"
	"avartworks/pkg/logger"
	"avartworks/services/user-service/internal/handler"
	"avartworks/services/user-service/internal/repository"
	"avartworks/services/user-service/internal/service"
	"avartworks/services/user-service/migrations"
)

const schema = "user_svc"

func main() {
	log := logger.New("user-service")
	ctx := context.Background()

	dbURL := config.Get("DATABASE_URL", "postgres://avart:avart_secret@localhost:5432/avartworks?sslmode=disable")
	redisURL := config.Get("REDIS_URL", "redis://localhost:6379/0")

	if err := database.RunMigrations(dbURL, schema, migrations.FS, "."); err != nil {
		log.Error("migrations failed", "err", err)
		return
	}
	log.Info("migrations applied", "schema", schema)

	pool, err := database.NewPool(ctx, database.Config{URL: dbURL, Schema: schema})
	if err != nil {
		log.Error("db connect failed", "err", err)
		return
	}
	defer pool.Close()

	rdb, err := cache.New(ctx, redisURL)
	if err != nil {
		log.Error("redis connect failed", "err", err)
		return
	}
	defer rdb.Close()

	tokens := auth.NewManager(
		config.Get("JWT_SECRET", "local-dev-secret-change-me"),
		config.GetDuration("JWT_ACCESS_TTL", 15*time.Minute),
		config.GetDuration("JWT_REFRESH_TTL", 168*time.Hour),
	)

	repo := repository.New(pool)
	svc := service.New(repo, tokens, rdb, log)

	if err := svc.EnsureAdmin(ctx, config.Get("ADMIN_EMAIL", ""), config.Get("ADMIN_PASSWORD", "")); err != nil {
		log.Error("ensure admin", "err", err)
	}

	corsOrigins := strings.Split(config.Get("CORS_ALLOWED_ORIGINS", "*"), ",")
	h := handler.New(svc, tokens)

	addr := config.Get("HTTP_ADDR", ":8081")
	if err := httpx.RunServer(addr, h.Routes(corsOrigins), log); err != nil {
		log.Error("server error", "err", err)
	}
}
