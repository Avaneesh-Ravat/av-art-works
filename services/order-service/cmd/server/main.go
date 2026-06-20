// Command server runs the AV Art Works Order Service.
package main

import (
	"context"
	"strings"
	"time"

	"avartworks/pkg/auth"
	"avartworks/pkg/config"
	"avartworks/pkg/database"
	"avartworks/pkg/httpx"
	"avartworks/pkg/logger"
	"avartworks/services/order-service/internal/client"
	"avartworks/services/order-service/internal/handler"
	"avartworks/services/order-service/internal/repository"
	"avartworks/services/order-service/internal/service"
	"avartworks/services/order-service/migrations"
)

const schema = "order_svc"

func main() {
	log := logger.New("order-service")
	ctx := context.Background()

	dbURL := config.Get("DATABASE_URL", "postgres://avart:avart_secret@localhost:5432/avartworks?sslmode=disable")

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

	tokens := auth.NewManager(
		config.Get("JWT_SECRET", "local-dev-secret-change-me"),
		config.GetDuration("JWT_ACCESS_TTL", 15*time.Minute),
		config.GetDuration("JWT_REFRESH_TTL", 168*time.Hour),
	)

	internalToken := config.Get("INTERNAL_TOKEN", "local-internal-token")
	catalog := client.NewCatalog(config.Get("CATALOG_INTERNAL_URL", "http://localhost:8082"), internalToken)

	repo := repository.New(pool)
	svc := service.New(repo, catalog, log)
	h := handler.New(svc, tokens, internalToken)

	corsOrigins := strings.Split(config.Get("CORS_ALLOWED_ORIGINS", "*"), ",")
	addr := config.Get("HTTP_ADDR", ":8083")
	if err := httpx.RunServer(addr, h.Routes(corsOrigins), log); err != nil {
		log.Error("server error", "err", err)
	}
}
