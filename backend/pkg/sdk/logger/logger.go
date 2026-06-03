package logger

import (
  "context"
  "log/slog"
  "os"
  "strings"
)

type ctxKey int

const requestIDKey ctxKey = 1

func New(serviceName string, level string) *slog.Logger {
  lvl := slog.LevelInfo
  switch strings.ToLower(strings.TrimSpace(level)) {
  case "debug":
    lvl = slog.LevelDebug
  case "warn", "warning":
    lvl = slog.LevelWarn
  case "error":
    lvl = slog.LevelError
  }

  h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
  return slog.New(h).With("service", serviceName)
}

func WithRequestID(ctx context.Context, requestID string) context.Context {
  return context.WithValue(ctx, requestIDKey, requestID)
}

func RequestIDFromContext(ctx context.Context) string {
  if ctx == nil {
    return ""
  }
  v, _ := ctx.Value(requestIDKey).(string)
  return v
}
