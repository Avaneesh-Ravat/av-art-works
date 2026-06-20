// Package logger provides a small wrapper around the standard library slog,
// configured for structured JSON logs suitable for CloudWatch ingestion.
package logger

import (
	"log/slog"
	"os"
)

// New returns a JSON structured logger tagged with the service name.
func New(service string) *slog.Logger {
	level := slog.LevelInfo
	if os.Getenv("LOG_LEVEL") == "debug" {
		level = slog.LevelDebug
	}
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(h).With("service", service)
}
