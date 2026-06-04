// Package middleware provides reusable HTTP middleware for backend services.
package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/errors"
	"backend/pkg/sdk/logger"

	"github.com/google/uuid"
)

type authContextKey struct{}
type currentUserContextKey struct{}

type CurrentUser struct {
	UserID string
	Email  string
	Name   string
}

// RequestID injects an X-Request-Id response header and request context value.
func RequestID() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get("X-Request-Id")
			if id == "" {
				id = uuid.NewString()
			}
			w.Header().Set("X-Request-Id", id)
			ctx := logger.WithRequestID(r.Context(), id)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequestLogger writes a structured request completion log line.
func RequestLogger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			log.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"request_id", logger.RequestIDFromContext(r.Context()),
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

// Recoverer recovers from panics and returns the shared API error shape.
func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error("panic recovered", "panic", rec, "request_id", logger.RequestIDFromContext(r.Context()))
					errors.WriteError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "Internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Recover is a panic recovery middleware for services that do not provide a logger.
func Recover(next http.Handler) http.Handler {
	return Recoverer(logger.New("http"))(next)
}

// CORS adds permissive CORS headers for browser clients.
func CORS() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-Id,X-User-Id")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Auth is a simple bearer-token placeholder that stores the token in request context.
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := authn.BearerToken(r)
		if token == "" {
			errors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Bearer token is required")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), authContextKey{}, token)))
	})
}

// BearerTokenFromContext returns the token captured by Auth.
func BearerTokenFromContext(ctx context.Context) string {
	v, _ := ctx.Value(authContextKey{}).(string)
	return v
}

func RequireJWTIdentity(validator *authn.Validator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := authn.BearerToken(r)
			if token == "" {
				errors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Bearer token is required")
				return
			}
			claims, err := validator.Validate(token)
			if err != nil {
				code := "UNAUTHORIZED"
				message := "Authentication is required."
				if err == authn.ErrTokenExpired {
					code = "TOKEN_EXPIRED"
					message = "Token has expired."
				}
				errors.WriteError(w, http.StatusUnauthorized, code, message)
				return
			}

			identity := authn.IdentityFromClaims(claims)
			headerUserID := strings.TrimSpace(r.Header.Get("X-User-Id"))
			if headerUserID != "" && headerUserID != identity.UserID {
				errors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
				return
			}

			r.Header.Set("X-User-Id", identity.UserID)
			ctx := authn.WithIdentity(r.Context(), identity)
			ctx = context.WithValue(ctx, currentUserContextKey{}, CurrentUser(identity))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func CurrentAuthenticatedUser(ctx context.Context) (CurrentUser, bool) {
	user, ok := ctx.Value(currentUserContextKey{}).(CurrentUser)
	return user, ok
}

func RequireInternalToken(token string) func(http.Handler) http.Handler {
	expected := strings.TrimSpace(token)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if expected == "" {
				errors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Internal service authentication is required.")
				return
			}
			if subtleEqual(strings.TrimSpace(r.Header.Get("X-Internal-Service-Token")), expected) {
				next.ServeHTTP(w, r)
				return
			}
			if subtleEqual(authn.BearerToken(r), expected) {
				next.ServeHTTP(w, r)
				return
			}
			errors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Internal service authentication is required.")
		})
	}
}

func subtleEqual(a, b string) bool {
	if len(a) != len(b) || a == "" {
		return false
	}
	var v byte
	for i := range a {
		v |= a[i] ^ b[i]
	}
	return v == 0
}
