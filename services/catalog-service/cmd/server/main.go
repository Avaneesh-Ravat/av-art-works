// Command server runs the AV Art Works Catalog Service.
package main

import (
	"context"
	"log/slog"
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

	// Use S3-compatible object storage when a bucket is configured (AWS S3 in
	// production, MinIO locally); otherwise fall back to the URL-only mock.
	store := buildStorage(ctx, log)

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

// buildStorage selects the object-storage backend from configuration.
func buildStorage(ctx context.Context, log *slog.Logger) storage.Storage {
	publicBase := config.Get("MEDIA_PUBLIC_BASE_URL", "/api/v1/media")
	bucket := config.Get("S3_BUCKET", "")
	if bucket == "" {
		log.Info("storage backend: mock (no S3_BUCKET configured)")
		return storage.NewMock(config.Get("IMAGE_BASE_URL", "http://localhost:8082/uploads"), publicBase)
	}
	s3store, err := storage.NewS3(ctx, storage.S3Config{
		Bucket:         bucket,
		Region:         config.Get("AWS_REGION", "ap-south-1"),
		Endpoint:       config.Get("S3_ENDPOINT", ""),
		PublicEndpoint: config.Get("S3_PUBLIC_ENDPOINT", config.Get("S3_ENDPOINT", "")),
		PublicBaseURL:  config.Get("S3_PUBLIC_BASE_URL", publicBase),
		ForcePathStyle: config.Get("S3_FORCE_PATH_STYLE", "") == "true",
		PresignTTL:     config.GetDuration("S3_PRESIGN_TTL", 15*time.Minute),
	})
	if err != nil {
		log.Error("s3 storage init failed; falling back to mock", "err", err)
		return storage.NewMock(config.Get("IMAGE_BASE_URL", "http://localhost:8082/uploads"), publicBase)
	}

	log.Info("storage backend: s3", "bucket", bucket, "endpoint", config.Get("S3_ENDPOINT", "aws"), "public_base", publicBase)
	return s3store
}
