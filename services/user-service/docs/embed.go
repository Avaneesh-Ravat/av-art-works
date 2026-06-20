// Package docs embeds the user-service OpenAPI specification.
package docs

import _ "embed"

//go:embed openapi.yaml
var OpenAPISpec []byte
