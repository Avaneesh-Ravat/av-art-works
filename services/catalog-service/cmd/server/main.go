// Command server runs the AV Art Works Catalog Service.
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
	"avartworks/pkg/storage"
	"avartworks/services/catalog-service/internal/handler"
	"avartworks/services/catalog-service/internal/repository"
	"avartworks/services/catalog-service/internal/service"
	"avartworks/services/catalog-service/migrations"
)

const schema = "catalog_svc"

func main() {
	log := logger.New("catalog-service")
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

	// Mock storage locally; replaced by an S3-backed implementation in AWS.
	store := storage.NewMock(config.Get("IMAGE_BASE_URL", "http://localhost:8082/uploads"))

	repo := repository.New(pool)
	svc := service.New(repo, rdb, store, log)
	internalToken := config.Get("INTERNAL_TOKEN", "local-internal-token")
	h := handler.New(svc, tokens, internalToken)

	corsOrigins := strings.Split(config.Get("CORS_ALLOWED_ORIGINS", "*"), ",")
	addr := config.Get("HTTP_ADDR", ":8082")
	if err := httpx.RunServer(addr, h.Routes(corsOrigins), log); err != nil {
		log.Error("server error", "err", err)
	}
}
