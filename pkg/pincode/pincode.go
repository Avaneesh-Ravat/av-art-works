// Package pincode looks up Indian postal pincodes via postalpincode.in and
// validates that city, state, and locality match the pincode.
package pincode

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const defaultAPI = "https://api.postalpincode.in/pincode"

var (
	ErrInvalidFormat = errors.New("invalid pincode format")
	ErrNotFound      = errors.New("pincode not found")
	ErrMismatch      = errors.New("address does not match pincode")
)

var formatRE = regexp.MustCompile(`^[1-9][0-9]{5}$`)

// Result is a normalized pincode lookup response.
type Result struct {
	Pincode    string   `json:"pincode"`
	City       string   `json:"city"`
	State      string   `json:"state"`
	Localities []string `json:"localities"`
}

// Client fetches pincode data from the postal API.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient constructs a pincode lookup client.
func NewClient() *Client {
	// postalpincode.in rejects Go's default HTTP/2 requests; force HTTP/1.1.
	transport := &http.Transport{
		TLSClientConfig:       &tls.Config{},
		ForceAttemptHTTP2:     false,
		ResponseHeaderTimeout: 8 * time.Second,
	}
	return &Client{
		baseURL: defaultAPI,
		http: &http.Client{
			Timeout:   8 * time.Second,
			Transport: transport,
		},
	}
}

// ValidFormat reports whether pincode is a 6-digit Indian pincode.
func ValidFormat(pincode string) bool {
	return formatRE.MatchString(strings.TrimSpace(pincode))
}

// Lookup fetches and normalizes pincode data.
func (c *Client) Lookup(ctx context.Context, pincode string) (*Result, error) {
	pincode = strings.TrimSpace(pincode)
	if !ValidFormat(pincode) {
		return nil, ErrInvalidFormat
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/%s", c.baseURL, pincode), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "AVArtWorks/1.0 (+https://avartworks.in)")
	req.Header.Set("Accept", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	return parseResponse(pincode, body)
}

type apiResponse struct {
	Status     string `json:"Status"`
	Message    string `json:"Message"`
	PostOffice []struct {
		Name     string `json:"Name"`
		District string `json:"District"`
		State    string `json:"State"`
	} `json:"PostOffice"`
}

func parseResponse(pincode string, body []byte) (*Result, error) {
	var wrapped []apiResponse
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, err
	}
	if len(wrapped) == 0 || wrapped[0].Status != "Success" || len(wrapped[0].PostOffice) == 0 {
		return nil, ErrNotFound
	}

	offices := wrapped[0].PostOffice
	city := strings.TrimSpace(offices[0].District)
	state := strings.TrimSpace(offices[0].State)
	if city == "" || state == "" {
		return nil, ErrNotFound
	}

	seen := make(map[string]bool)
	var localities []string
	for _, o := range offices {
		name := strings.TrimSpace(o.Name)
		if name == "" || seen[normalize(name)] {
			continue
		}
		seen[normalize(name)] = true
		localities = append(localities, name)
	}
	if len(localities) == 0 {
		return nil, ErrNotFound
	}

	return &Result{
		Pincode:    pincode,
		City:       city,
		State:      state,
		Localities: localities,
	}, nil
}

// Matches reports whether city, state, and locality are valid for the lookup result.
func Matches(result *Result, city, state, locality string) bool {
	if result == nil {
		return false
	}
	if normalize(result.City) != normalize(city) || normalize(result.State) != normalize(state) {
		return false
	}
	for _, loc := range result.Localities {
		if normalize(loc) == normalize(locality) {
			return true
		}
	}
	return false
}

func normalize(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
