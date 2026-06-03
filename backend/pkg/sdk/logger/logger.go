// Package logger provides structured JSON logging shared by backend services.
package logger

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

type ctxKey int

const requestIDKey ctxKey = 1

// New returns a JSON slog logger annotated with the service name.
func New(serviceName string, level ...string) *slog.Logger {
	lvl := slog.LevelInfo
	if len(level) > 0 {
		switch strings.ToLower(strings.TrimSpace(level[0])) {
		case "debug":
			lvl = slog.LevelDebug
		case "warn", "warning":
			lvl = slog.LevelWarn
		case "error":
			lvl = slog.LevelError
		}
	}

	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
	return slog.New(h).With("service", serviceName)
}

// WithRequestID stores a request ID on the context for middleware and handlers.
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

// RequestIDFromContext returns a request ID previously stored on the context.
func RequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	v, _ := ctx.Value(requestIDKey).(string)
	return v
}

// WithRequestIDField annotates a logger with a request_id field when one exists.
func WithRequestIDField(log *slog.Logger, ctx context.Context) *slog.Logger {
	if log == nil {
		log = New("")
	}
	if requestID := RequestIDFromContext(ctx); requestID != "" {
		return log.With("request_id", requestID)
	}
	return log
}
