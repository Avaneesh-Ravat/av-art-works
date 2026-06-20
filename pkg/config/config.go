// Package config loads service configuration from environment variables.
// Local development reads from a .env file (see .env.example); in AWS the
// same variables are injected from Secrets Manager / SSM.
package config

import (
	"os"
	"strconv"
	"time"
)

// Get returns the value of an env var or a fallback default.
func Get(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// GetInt returns an int env var or a fallback default.
func GetInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// GetDuration parses a duration env var (e.g. "15m") or a fallback default.
func GetDuration(key string, fallback time.Duration) time.Duration {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
