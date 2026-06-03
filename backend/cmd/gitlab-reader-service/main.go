package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	internalgitlab "backend/internal/gitlab"
	"backend/pkg/sdk/config"
	"backend/pkg/sdk/database"
	"backend/pkg/sdk/gitlabclient"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/middleware"
	"backend/pkg/sdk/queue"

	"github.com/go-chi/chi/v5"
)

func main() {
	cfg, err := config.LoadFromEnv("gitlab-reader-service")
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

	store := internalgitlab.NewPostgresStore(db)
	if err := store.EnsureSchema(context.Background()); err != nil {
		log.Error("database schema initialization failed", "err", err)
		os.Exit(1)
	}

	redisClient := queue.NewRedisClient(queue.RedisConfig{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB})
	defer redisClient.Close()

	gl := gitlabclient.New(cfg.GitLabBaseURL, cfg.GitLabBotToken)
	filter := internalgitlab.NewFileFilter(maxFileSizeBytes())
	service := internalgitlab.NewService(
		store,
		internalgitlab.NewValidator(cfg.GitLabBaseURL),
		gl,
		queue.NewProducerWithQueue(redisClient, cfg.AnalysisQueueName),
		filter,
		log,
	)
	handler := internalgitlab.NewHandler(service)

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	r.Use(middleware.RequestLogger(log))
	r.Use(middleware.Recoverer(log))
	r.Use(middleware.CORS())
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	r.Mount("/", handler.Routes())

	srv := &http.Server{Addr: cfg.HTTPAddr(), Handler: r, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Info("http server started", "addr", cfg.HTTPAddr(), "gitlab_base_url", cfg.GitLabBaseURL, "bot_username", cfg.GitLabBotUsername)
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

func maxFileSizeBytes() int {
	value := os.Getenv("MAX_FILE_SIZE_BYTES")
	if value == "" {
		return internalgitlab.DefaultMaxFileSizeBytes
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return internalgitlab.DefaultMaxFileSizeBytes
	}
	return parsed
}
