package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"

	"backend/internal/auth"
	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/logger"
)

const testJWTSecret = "gateway-test-secret"

func TestGatewayRoutesBrowserEndpointsToExpectedServices(t *testing.T) {
	validator := newValidator(t)
	router := newRouterWithHandlers(
		logger.New("api-gateway-test"),
		validator,
		newFixedHandler("auth ok"),
		newRecordingHandler(t, func(r *http.Request) string {
			requireTrustedUserID(t, r)
			return "gitea ok"
		}),
		newRecordingHandler(t, func(r *http.Request) string {
			requireTrustedUserID(t, r)
			return "question ok"
		}),
		newRecordingHandler(t, func(r *http.Request) string {
			requireTrustedUserID(t, r)
			return "exam ok"
		}),
	)
	token := issueToken(t)

	cases := []struct {
		name   string
		method string
		path   string
		want   string
	}{
		{name: "auth login", method: http.MethodGet, path: "/auth/login", want: "auth ok"},
		{name: "repository create", method: http.MethodPost, path: "/repositories", want: "gitea ok"},
		{name: "analysis job status", method: http.MethodGet, path: "/analysis-jobs/123", want: "gitea ok"},
		{name: "analysis job questions", method: http.MethodGet, path: "/analysis-jobs/123/questions", want: "question ok"},
		{name: "exam questions", method: http.MethodGet, path: "/exams/123/questions", want: "question ok"},
		{name: "exam submit", method: http.MethodPost, path: "/exams/123/submit", want: "exam ok"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.path != "/auth/login" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
			if body := rec.Body.String(); body != tc.want {
				t.Fatalf("body=%q want=%q", body, tc.want)
			}
		})
	}
}

func TestGatewayReturnsNotFoundForUnknownRoute(t *testing.T) {
	validator := newValidator(t)
	router := newRouterWithHandlers(
		logger.New("api-gateway-test"),
		validator,
		newFixedHandler("auth ok"),
		newFixedHandler("gitea ok"),
		newFixedHandler("question ok"),
		newFixedHandler("exam ok"),
	)
	req := httptest.NewRequest(http.MethodGet, "/unknown", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGatewayRejectsProtectedRoutesWithoutToken(t *testing.T) {
	validator := newValidator(t)
	router := newRouterWithHandlers(
		logger.New("api-gateway-test"),
		validator,
		newFixedHandler("auth ok"),
		newFixedHandler("gitea ok"),
		newFixedHandler("question ok"),
		newFixedHandler("exam ok"),
	)
	req := httptest.NewRequest(http.MethodGet, "/repositories/123", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGatewayRejectsExpiredToken(t *testing.T) {
	token := issueToken(t)
	expiredValidator, err := authn.NewValidator(testJWTSecret, authn.WithNow(func() time.Time {
		return time.Now().UTC().Add(2 * time.Hour)
	}))
	if err != nil {
		t.Fatal(err)
	}
	router := newRouterWithHandlers(
		logger.New("api-gateway-test"),
		expiredValidator,
		newFixedHandler("auth ok"),
		newFixedHandler("gitea ok"),
		newFixedHandler("question ok"),
		newFixedHandler("exam ok"),
	)
	req := httptest.NewRequest(http.MethodGet, "/repositories/123", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestStripUpstreamCORSHeaders(t *testing.T) {
	headers := http.Header{}
	headers.Add("Access-Control-Allow-Origin", "*")
	headers.Add("Access-Control-Allow-Origin", "http://upstream.example")
	headers.Add("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
	headers.Add("Access-Control-Allow-Methods", "POST")
	headers.Add("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-Id,X-User-Id")
	headers.Add("Access-Control-Allow-Headers", "Content-Type")
	headers.Add("Access-Control-Allow-Credentials", "true")
	headers.Add("Access-Control-Expose-Headers", "X-Request-Id")
	headers.Add("Access-Control-Max-Age", "600")
	headers.Add("Content-Type", "application/json")

	stripUpstreamCORSHeaders(headers)

	if got := headers.Values("Access-Control-Allow-Origin"); len(got) != 0 {
		t.Fatalf("origin headers=%v", got)
	}
	if got := headers.Values("Access-Control-Allow-Methods"); len(got) != 0 {
		t.Fatalf("methods headers=%v", got)
	}
	if got := headers.Values("Access-Control-Allow-Headers"); len(got) != 0 {
		t.Fatalf("headers headers=%v", got)
	}
	if got := headers.Values("Access-Control-Allow-Credentials"); len(got) != 0 {
		t.Fatalf("credentials headers=%v", got)
	}
	if got := headers.Values("Access-Control-Expose-Headers"); len(got) != 0 {
		t.Fatalf("expose headers=%v", got)
	}
	if got := headers.Values("Access-Control-Max-Age"); len(got) != 0 {
		t.Fatalf("max-age headers=%v", got)
	}
	if got := headers.Values("Content-Type"); !slices.Equal(got, []string{"application/json"}) {
		t.Fatalf("content-type headers=%v", got)
	}
}

func newFixedHandler(body string) http.Handler {
	return newRecordingHandler(nil, func(*http.Request) string {
		return body
	})
}

func newRecordingHandler(t *testing.T, responder func(*http.Request) string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := w.Write([]byte(responder(r))); err != nil && t != nil {
			t.Fatalf("write response: %v", err)
		}
	})
}

func requireTrustedUserID(t *testing.T, r *http.Request) {
	t.Helper()
	if r.Header.Get("X-User-Id") != "00000000-0000-0000-0000-000000000001" {
		t.Fatalf("gateway did not forward trusted user id: %q", r.Header.Get("X-User-Id"))
	}
}

func newValidator(t *testing.T) *authn.Validator {
	t.Helper()
	validator, err := authn.NewValidator(testJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	return validator
}

func issueToken(t *testing.T) string {
	t.Helper()
	tm, err := auth.NewTokenManager(testJWTSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	token, err := tm.Generate(auth.User{
		ID:    "00000000-0000-0000-0000-000000000001",
		Email: "student@example.com",
		Name:  "Student User",
	})
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestMain(m *testing.M) {
	code := m.Run()
	_ = os.Unsetenv("AUTH_SERVICE_BASE_URL")
	_ = os.Unsetenv("GITEA_READER_SERVICE_BASE_URL")
	_ = os.Unsetenv("QUESTION_SERVICE_BASE_URL")
	_ = os.Unsetenv("EXAM_SERVICE_BASE_URL")
	os.Exit(code)
}
