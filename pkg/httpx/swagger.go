package httpx

import "net/http"

// MountSwagger serves a raw OpenAPI spec at /openapi.yaml and a Swagger UI
// (loaded from a CDN) at /docs for the given service.
func MountSwagger(mux interface {
	Get(pattern string, h http.HandlerFunc)
}, spec []byte) {
	mux.Get("/openapi.yaml", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/yaml")
		_, _ = w.Write(spec)
	})
	mux.Get("/docs", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(swaggerHTML))
	})
}

const swaggerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>AV Art Works API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({ url: "openapi.yaml", dom_id: "#swagger-ui" });
    };
  </script>
</body>
</html>`
