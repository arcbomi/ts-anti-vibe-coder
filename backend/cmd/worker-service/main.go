package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal/worker"
	"backend/pkg/sdk/aiclient"
	"backend/pkg/sdk/config"
	"backend/pkg/sdk/database"
	"backend/pkg/sdk/gitlabclient"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/queue"
)

func main() {
	cfg, err := config.LoadFromEnv("worker-service")
	if err != nil {
		panic(err)
	}
	log := logger.New(cfg.ServiceName, cfg.LogLevel)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close() }()

	store := worker.NewPostgresStore(db)
	if err := store.EnsureSchema(context.Background()); err != nil {
		log.Error("worker database schema setup failed", "err", err)
		os.Exit(1)
	}

	redisClient := queue.NewRedisClient(queue.RedisConfig{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB})
	defer func() { _ = redisClient.Close() }()
	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Error("queue connection failed", "err", err)
		os.Exit(1)
	}

	gitlabClient := gitlabclient.New(cfg.GitLabBaseURL, cfg.GitLabBotToken)
	aiClient := aiclient.New(cfg.AIBaseURL, cfg.AIAPIKey, cfg.AIModel, aiclient.WithTimeout(time.Duration(cfg.AITimeoutSeconds)*time.Second))
	runner := worker.NewJobRunner(store, gitlabClient, aiClient, log)
	handler := worker.NewHandler(runner, store, log)
	consumer := worker.NewConsumer(redisClient, handler, worker.ConsumerConfig{
		QueueName:       cfg.AnalysisQueueName,
		DeadLetterQueue: cfg.AnalysisDeadLetterQueueName,
		Concurrency:     cfg.WorkerConcurrency,
		Retry:           worker.RetryConfig{MaxAttempts: cfg.MaxJobAttempts, Delay: time.Duration(cfg.RetryDelaySeconds) * time.Second},
	}, log)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Info("worker service started", "queue", cfg.AnalysisQueueName, "dead_letter_queue", cfg.AnalysisDeadLetterQueueName, "concurrency", cfg.WorkerConcurrency)
	if err := consumer.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Error("worker service stopped with error", "err", err)
		os.Exit(1)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = database.Ping(shutdownCtx, db)
	log.Info("shutdown complete")
}
