// Package migrations embeds the catalog-service SQL migrations.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
