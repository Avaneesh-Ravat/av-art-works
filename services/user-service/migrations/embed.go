// Package migrations embeds the user-service SQL migration files so they can
// be applied at startup without shipping them alongside the binary.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
