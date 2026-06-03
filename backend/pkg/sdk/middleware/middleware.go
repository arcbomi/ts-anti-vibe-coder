// Package middleware provides reusable HTTP middleware for backend services.
package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"backend/pkg/sdk/errors"
	"backend/pkg/sdk/logger"

	"github.com/google/uuid"
)

type authContextKey struct{}

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
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-Id")
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
		token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if token == "" || token == r.Header.Get("Authorization") {
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
