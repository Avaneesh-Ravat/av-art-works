package pincode

import (
	"context"
	"testing"
)

func TestValidFormat(t *testing.T) {
	if !ValidFormat("122001") {
		t.Fatal("expected valid pincode")
	}
	if ValidFormat("012345") || ValidFormat("12345") || ValidFormat("abcdef") {
		t.Fatal("expected invalid pincode")
	}
}

func TestParseResponse(t *testing.T) {
	body := []byte(`[{
		"Status":"Success",
		"PostOffice":[
			{"Name":"Arjun Nagar","District":"Gurgaon","State":"Haryana"},
			{"Name":"Basai Road","District":"Gurgaon","State":"Haryana"}
		]
	}]`)
	result, err := parseResponse("122001", body)
	if err != nil {
		t.Fatal(err)
	}
	if result.City != "Gurgaon" || result.State != "Haryana" {
		t.Fatalf("unexpected location: %+v", result)
	}
	if len(result.Localities) != 2 {
		t.Fatalf("expected 2 localities, got %d", len(result.Localities))
	}
	if !Matches(result, "Gurgaon", "Haryana", "Basai Road") {
		t.Fatal("expected locality match")
	}
}

func TestLookupLive(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping live pincode lookup")
	}
	result, err := NewClient().Lookup(context.Background(), "122001")
	if err != nil {
		t.Fatal(err)
	}
	if result.City == "" || result.State == "" || len(result.Localities) == 0 {
		t.Fatalf("incomplete result: %+v", result)
	}
}
