package httpx

import (
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimit returns Redis-backed fixed-window rate limiting middleware,
// keyed by client IP. Limits requests to `limit` per `window`.
func RateLimit(rdb *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			key := "ratelimit:" + ip + ":" + strconv.FormatInt(time.Now().Unix()/int64(window.Seconds()), 10)

			count, err := rdb.Incr(r.Context(), key).Result()
			if err == nil {
				if count == 1 {
					rdb.Expire(r.Context(), key, window)
				}
				if count > int64(limit) {
					w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
					Error(w, http.StatusTooManyRequests, "rate_limited", "too many requests")
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := indexComma(xff); i >= 0 {
			return xff[:i]
		}
		return xff
	}
	return r.RemoteAddr
}

func indexComma(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			return i
		}
	}
	return -1
}
