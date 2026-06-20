// Package docs embeds the catalog-service OpenAPI specification.
package docs

import _ "embed"

//go:embed openapi.yaml
var OpenAPISpec []byte
