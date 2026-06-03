package middleware

import (
  "log/slog"
  "net/http"
  "time"

  "backend/pkg/sdk/logger"

  "github.com/google/uuid"
)

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

func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
  return func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
      defer func() {
        if rec := recover(); rec != nil {
          log.Error("panic recovered", "panic", rec, "request_id", logger.RequestIDFromContext(r.Context()))
          w.WriteHeader(http.StatusInternalServerError)
          _, _ = w.Write([]byte("internal server error"))
        }
      }()
      next.ServeHTTP(w, r)
    })
  }
}

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
