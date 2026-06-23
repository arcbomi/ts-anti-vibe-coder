package auth

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestTomorrowSchoolClientAuthenticateSuccess(t *testing.T) {
	client := NewTomorrowSchoolClient(TomorrowSchoolClientConfig{
		Endpoint:  "https://tomorrow.example.com/api/auth/signin",
		Timeout:   time.Second,
		Referrer:  "https://01.tomorrow-school.ai/?show-password=1",
		XJWTToken: "undefined",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != http.MethodPost {
				t.Fatalf("method = %s, want POST", r.Method)
			}
			if got := r.Header.Get("Authorization"); got != "Basic "+base64.StdEncoding.EncodeToString([]byte("student@example.com:correct-password")) {
				t.Fatalf("authorization header = %q", got)
			}
			if got := r.Header.Get("Referer"); got != "https://01.tomorrow-school.ai/?show-password=1" {
				t.Fatalf("referer = %q", got)
			}
			return jsonResponse(http.StatusOK, `{"jwt":"remote-jwt","user":{"email":"student@example.com","name":"student-user","full_name":"Student User"}}`), nil
		})},
	}, nil)

	identity, err := client.Authenticate(context.Background(), "student@example.com", "correct-password")
	if err != nil {
		t.Fatalf("Authenticate returned error: %v", err)
	}
	if identity.RemoteToken != "remote-jwt" || identity.Name != "Student User" || identity.FullName != "Student User" {
		t.Fatalf("Authenticate returned wrong identity: %+v", identity)
	}
}

func TestTomorrowSchoolClientAuthenticateSuccessWithBareJSONStringToken(t *testing.T) {
	client := NewTomorrowSchoolClient(TomorrowSchoolClientConfig{
		Endpoint: "https://tomorrow.example.com/api/auth/signin",
		Timeout:  time.Second,
		HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusOK, `"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxNTkwOSJ9.signature"`), nil
		})},
	}, nil)

	identity, err := client.Authenticate(context.Background(), "dmukhat", "correct-password")
	if err != nil {
		t.Fatalf("Authenticate returned error: %v", err)
	}
	if identity.RemoteToken == "" {
		t.Fatal("Authenticate returned empty remote token")
	}
	if identity.Email != "tomorrow-school-15909@tomorrow-school.local" {
		t.Fatalf("Authenticate email = %q, want fallback synthetic email", identity.Email)
	}
	if identity.Username != "dmukhat" || identity.Name != "dmukhat" {
		t.Fatalf("Authenticate returned wrong username fallback identity: %+v", identity)
	}
}

func TestTomorrowSchoolClientAuthenticateInvalidCredentials(t *testing.T) {
	client := NewTomorrowSchoolClient(TomorrowSchoolClientConfig{
		Endpoint: "https://tomorrow.example.com/api/auth/signin",
		Timeout:  time.Second,
		HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusUnauthorized, `{"error":"User does not exist or password incorrect"}`), nil
		})},
	}, nil)

	_, err := client.Authenticate(context.Background(), "student@example.com", "wrong-password")
	if err != ErrInvalidCredentials {
		t.Fatalf("Authenticate error = %v, want ErrInvalidCredentials", err)
	}
}

func TestTomorrowSchoolClientAuthenticateAcceptsUsernameCredential(t *testing.T) {
	client := NewTomorrowSchoolClient(TomorrowSchoolClientConfig{
		Endpoint: "https://tomorrow.example.com/api/auth/signin",
		Timeout:  time.Second,
		HTTPClient: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if got := r.Header.Get("Authorization"); got != "Basic "+base64.StdEncoding.EncodeToString([]byte("student-user:correct-password")) {
				t.Fatalf("authorization header = %q", got)
			}
			return jsonResponse(http.StatusOK, `{"jwt":"remote-jwt","user":{"email":"student@example.com","username":"student-user"}}`), nil
		})},
	}, nil)

	identity, err := client.Authenticate(context.Background(), "student-user", "correct-password")
	if err != nil {
		t.Fatalf("Authenticate returned error: %v", err)
	}
	if identity.Email != "student@example.com" || identity.Username != "student-user" {
		t.Fatalf("Authenticate returned wrong identity: %+v", identity)
	}
}

func TestTomorrowSchoolClientAuthenticateInvalidCredentialsOnForbidden(t *testing.T) {
	client := NewTomorrowSchoolClient(TomorrowSchoolClientConfig{
		Endpoint: "https://tomorrow.example.com/api/auth/signin",
		Timeout:  time.Second,
		HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusForbidden, `{"error":"User does not exist or password incorrect"}`), nil
		})},
	}, nil)

	_, err := client.Authenticate(context.Background(), "student@example.com", "wrong-password")
	if err != ErrInvalidCredentials {
		t.Fatalf("Authenticate error = %v, want ErrInvalidCredentials", err)
	}
}

func TestTomorrowSchoolClientAuthenticateTimeout(t *testing.T) {
	client := NewTomorrowSchoolClient(TomorrowSchoolClientConfig{
		Endpoint: "https://tomorrow.example.com/api/auth/signin",
		Timeout:  10 * time.Millisecond,
		HTTPClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, timeoutErr{}
		})},
	}, nil)

	_, err := client.Authenticate(context.Background(), "student@example.com", "correct-password")
	if err == nil || !errors.Is(err, ErrAuthProviderTimedOut) {
		t.Fatalf("Authenticate error = %v, want ErrAuthProviderTimedOut", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

type timeoutErr struct{}

func (timeoutErr) Error() string   { return "timeout" }
func (timeoutErr) Timeout() bool   { return true }
func (timeoutErr) Temporary() bool { return true }
