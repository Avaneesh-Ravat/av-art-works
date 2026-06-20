// Package migrations embeds the payment-service SQL migrations.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
