package auth

import (
	"testing"
	"time"
)

func TestAccessTokenRoundTrip(t *testing.T) {
	m := NewManager("test-secret", 15*time.Minute, time.Hour)

	tok, err := m.GenerateAccess("user-123", "a@b.com", RoleAdmin)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	claims, err := m.ParseAccess(tok)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UserID != "user-123" {
		t.Errorf("uid = %q, want user-123", claims.UserID)
	}
	if claims.Role != RoleAdmin {
		t.Errorf("role = %q, want admin", claims.Role)
	}
}

func TestAccessTokenWrongSecret(t *testing.T) {
	m1 := NewManager("secret-a", time.Minute, time.Hour)
	m2 := NewManager("secret-b", time.Minute, time.Hour)

	tok, _ := m1.GenerateAccess("u", "e", RoleUser)
	if _, err := m2.ParseAccess(tok); err == nil {
		t.Fatal("expected error parsing token signed with a different secret")
	}
}

func TestExpiredToken(t *testing.T) {
	m := NewManager("s", -time.Minute, time.Hour) // already expired
	tok, _ := m.GenerateAccess("u", "e", RoleUser)
	if _, err := m.ParseAccess(tok); err == nil {
		t.Fatal("expected expired token to fail validation")
	}
}
