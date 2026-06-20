// Command server runs the AV Art Works Payment Service.
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
	"avartworks/services/payment-service/internal/client"
	"avartworks/services/payment-service/internal/handler"
	"avartworks/services/payment-service/internal/provider"
	"avartworks/services/payment-service/internal/repository"
	"avartworks/services/payment-service/internal/service"
	"avartworks/services/payment-service/migrations"
)

const schema = "payment_svc"

func main() {
	log := logger.New("payment-service")
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

	// Razorpay-shaped mock gateway. Replace with a real provider in production.
	gw := provider.NewMockRazorpay(
		config.Get("RAZORPAY_KEY_ID", "rzp_test_mockkey"),
		config.Get("RAZORPAY_KEY_SECRET", "mock_key_secret"),
		config.Get("RAZORPAY_WEBHOOK_SECRET", "mock_webhook_secret"),
	)

	internalToken := config.Get("INTERNAL_TOKEN", "local-internal-token")
	orders := client.NewOrderClient(config.Get("ORDER_INTERNAL_URL", "http://localhost:8083"), internalToken)

	repo := repository.New(pool)
	svc := service.New(repo, gw, orders, log)
	h := handler.New(svc, tokens)

	corsOrigins := strings.Split(config.Get("CORS_ALLOWED_ORIGINS", "*"), ",")
	addr := config.Get("HTTP_ADDR", ":8084")
	if err := httpx.RunServer(addr, h.Routes(corsOrigins), log); err != nil {
		log.Error("server error", "err", err)
	}
}
