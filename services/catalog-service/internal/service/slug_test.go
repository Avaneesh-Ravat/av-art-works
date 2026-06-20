package service

import "testing"

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Ocean Wave Resin Tray": "ocean-wave-resin-tray",
		"  Golden  Horizon!! ":  "golden-horizon",
		"Acrylic #1 (Sunset)":   "acrylic-1-sunset",
		"Mandala—Wall_Hanging":  "mandala-wall-hanging",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}
