// Package migrations embeds the order-service SQL migrations.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
