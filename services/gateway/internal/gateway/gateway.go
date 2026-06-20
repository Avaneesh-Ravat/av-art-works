// Package gateway implements the public API gateway: a reverse proxy that
// routes requests to the backend microservices by path prefix, enforces
// centralized JWT auth on protected routes, and injects trusted identity
// headers for downstream services.
package gateway

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	"avartworks/pkg/auth"
	"avartworks/pkg/httpx"
)

// Backends holds the upstream base URLs for each service.
type Backends struct {
	User    string
	Catalog string
	Order   string
	Payment string
}

// Options configures the gateway.
type Options struct {
	Backends     Backends
	Tokens       *auth.Manager
	Redis        *redis.Client
	CORSOrigins  []string
	RateLimit    int
	RateWindow   time.Duration
}

// route maps a path prefix to an upstream, marking whether auth is required.
type route struct {
	prefix    string
	target    string
	protected bool
}

// Handler builds the gateway HTTP handler.
func Handler(opts Options) (http.Handler, error) {
	b := opts.Backends
	tokens := opts.Tokens
	routes := []route{
		{"/api/v1/auth", b.User, false},
		{"/api/v1/users", b.User, true},
		{"/api/v1/admin/users", b.User, true},

		{"/api/v1/products", b.Catalog, false}, // GET public; writes enforced downstream
		{"/api/v1/categories", b.Catalog, false},
		{"/api/v1/uploads", b.Catalog, true},

		{"/api/v1/cart", b.Order, true},
		{"/api/v1/orders", b.Order, true},
		{"/api/v1/wishlist", b.Order, true},
		{"/api/v1/admin/orders", b.Order, true},

		{"/api/v1/payments/webhook", b.Payment, false}, // gateway-public, HMAC-verified downstream
		{"/api/v1/payments", b.Payment, true},
	}
	// Longest prefix first so e.g. /payments/webhook beats /payments.
	sort.Slice(routes, func(i, j int) bool { return len(routes[i].prefix) > len(routes[j].prefix) })

	proxies := map[string]*httputil.ReverseProxy{}
	for _, r := range routes {
		if _, ok := proxies[r.target]; ok {
			continue
		}
		u, err := url.Parse(r.target)
		if err != nil {
			return nil, err
		}
		proxies[r.target] = newProxy(u)
	}

	mux := chi.NewRouter()
	mux.Use(httpx.CORS(opts.CORSOrigins))
	if opts.Redis != nil && opts.RateLimit > 0 {
		mux.Use(httpx.RateLimit(opts.Redis, opts.RateLimit, opts.RateWindow))
	}

	mux.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "gateway"})
	})

	mux.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
		// Prevent header spoofing: clients can never set trusted/internal headers.
		r.Header.Del("X-User-Id")
		r.Header.Del("X-User-Role")
		r.Header.Del("X-Internal-Token")

		match, ok := matchRoute(routes, r.URL.Path)
		if !ok {
			httpx.Error(w, http.StatusNotFound, "not_found", "no route for path")
			return
		}

		if match.protected {
			claims, err := authenticate(tokens, r)
			if err != nil {
				httpx.Error(w, http.StatusUnauthorized, "unauthorized", "missing or invalid token")
				return
			}
			// Forward identity to the backend (defense-in-depth: backend re-validates too).
			r.Header.Set("X-User-Id", claims.UserID)
			r.Header.Set("X-User-Role", string(claims.Role))
		}

		proxies[match.target].ServeHTTP(w, r)
	})

	return mux, nil
}

func matchRoute(routes []route, path string) (route, bool) {
	for _, r := range routes {
		if path == r.prefix || strings.HasPrefix(path, r.prefix+"/") {
			return r, true
		}
	}
	return route{}, false
}

func authenticate(tokens *auth.Manager, r *http.Request) (*auth.Claims, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, http.ErrNoCookie
	}
	return tokens.ParseAccess(strings.TrimPrefix(header, "Bearer "))
}

func newProxy(target *url.URL) *httputil.ReverseProxy {
	p := httputil.NewSingleHostReverseProxy(target)
	defaultDirector := p.Director
	p.Director = func(req *http.Request) {
		defaultDirector(req)
		req.Host = target.Host
	}
	p.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		httpx.Error(w, http.StatusBadGateway, "bad_gateway", "upstream service unavailable")
	}
	return p
}
