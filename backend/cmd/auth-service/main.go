package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal/auth"
	"backend/pkg/sdk/config"
	"backend/pkg/sdk/database"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/middleware"

	"github.com/go-chi/chi/v5"
)

func main() {
	cfg, err := config.LoadFromEnv("auth-service")
	if err != nil {
		panic(err)
	}
	log := logger.New(cfg.ServiceName, cfg.LogLevel)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	tokenManager, err := auth.NewTokenManager(cfg.JWTSecret, time.Duration(cfg.JWTAccessTokenTTLMinutes)*time.Minute)
	if err != nil {
		log.Error("token manager initialization failed", "err", err)
		os.Exit(1)
	}
	authRepository := auth.NewRepository(db)
	authService := auth.NewService(authRepository, tokenManager)
	authHandler := auth.NewHandler(authService)

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	r.Use(middleware.RequestLogger(log))
	r.Use(middleware.Recoverer(log))
	r.Use(middleware.CORS())
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	authHandler.RegisterRoutes(r)

	srv := &http.Server{Addr: cfg.HTTPAddr(), Handler: r, ReadHeaderTimeout: 5 * time.Second}
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
