package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/config"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/middleware"

	"github.com/go-chi/chi/v5"
)

func main() {
	cfg, err := config.LoadFromEnv("api-gateway")
	if err != nil {
		panic(err)
	}

	log := logger.New(cfg.ServiceName, cfg.LogLevel)
	validator, err := authn.NewValidator(cfg.JWTSecret)
	if err != nil {
		panic(err)
	}
	r := newRouter(log, validator)

	srv := &http.Server{
		Addr:              cfg.HTTPAddr(),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("http server started", "addr", cfg.HTTPAddr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("http server failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Info("shutdown complete")
}

func newRouter(log *slog.Logger, validator *authn.Validator) http.Handler {
	authProxy := mustNewReverseProxy(serviceBaseURL("AUTH_SERVICE_BASE_URL", "http://localhost:8081"))
	gitlabProxy := mustNewReverseProxy(serviceBaseURL("GITLAB_READER_SERVICE_BASE_URL", "http://localhost:8082"))
	questionProxy := mustNewReverseProxy(serviceBaseURL("QUESTION_SERVICE_BASE_URL", "http://localhost:8084"))
	examProxy := mustNewReverseProxy(serviceBaseURL("EXAM_SERVICE_BASE_URL", "http://localhost:8085"))
	return newRouterWithHandlers(log, validator, authProxy, gitlabProxy, questionProxy, examProxy)
}

func newRouterWithHandlers(log *slog.Logger, validator *authn.Validator, authProxy, gitlabProxy, questionProxy, examProxy http.Handler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	r.Use(middleware.RequestLogger(log))
	r.Use(middleware.Recoverer(log))
	r.Use(middleware.CORS())

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	r.Handle("/auth/*", authProxy)
	r.Handle("/auth", authProxy)
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireJWTIdentity(validator))
		r.Handle("/repositories/*", gitlabProxy)
		r.Handle("/repositories", gitlabProxy)
		r.Handle("/analysis-jobs/{id}/questions", questionProxy)
		r.Handle("/analysis-jobs/{id}", gitlabProxy)
		r.Handle("/exams/{id}/questions", questionProxy)
		r.Handle("/exams/*", examProxy)
		r.Handle("/exams", examProxy)
	})
	return r
}

func serviceBaseURL(envKey string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(envKey)); value != "" {
		return value
	}
	return fallback
}

func mustNewReverseProxy(rawURL string) http.Handler {
	target, err := url.Parse(rawURL)
	if err != nil {
		panic(fmt.Errorf("invalid proxy target %q: %w", rawURL, err))
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
		if _, ok := req.Header["X-Forwarded-Host"]; !ok && req.Host != "" {
			req.Header.Set("X-Forwarded-Host", req.Host)
		}
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		stripUpstreamCORSHeaders(resp.Header)
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		status := http.StatusBadGateway
		var netErr net.Error
		if os.IsTimeout(err) || (errors.As(err, &netErr) && netErr.Timeout()) {
			status = http.StatusGatewayTimeout
		}
		http.Error(w, http.StatusText(status), status)
	}
	return proxy
}

func stripUpstreamCORSHeaders(headers http.Header) {
	headers.Del("Access-Control-Allow-Origin")
	headers.Del("Access-Control-Allow-Methods")
	headers.Del("Access-Control-Allow-Headers")
	headers.Del("Access-Control-Allow-Credentials")
	headers.Del("Access-Control-Expose-Headers")
	headers.Del("Access-Control-Max-Age")
}
