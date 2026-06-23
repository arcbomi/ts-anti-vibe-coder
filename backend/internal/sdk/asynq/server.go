package asynqsdk

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/hibiken/asynq"
)

type Server struct {
	server          *asynq.Server
	mux             *asynq.ServeMux
	log             *slog.Logger
	shutdownTimeout time.Duration
}

func NewServer(redisConfig RedisConfig, cfg ServerConfig, handlers ...JobHandler) *Server {
	cfg = cfg.normalize()

	log := cfg.Logger
	if log == nil {
		log = slog.Default()
	}

	mux := asynq.NewServeMux()
	for _, handler := range handlers {
		if handler != nil {
			handler.Register(mux)
		}
	}

	srv := asynq.NewServer(redisConfig.asynq(), asynq.Config{
		Concurrency:    cfg.Concurrency,
		Queues:         cfg.Queues,
		StrictPriority: cfg.StrictPriority,
		RetryDelayFunc: cfg.RetryDelayFunc,
		ErrorHandler:   errorLogger{log: log},
	})

	return &Server{
		server:          srv,
		mux:             mux,
		log:             log,
		shutdownTimeout: cfg.Timeout.ShutdownTimeout,
	}
}

func (s *Server) Mux() *asynq.ServeMux {
	if s == nil {
		return nil
	}
	return s.mux
}

func (s *Server) Run(ctx context.Context) error {
	if s == nil || s.server == nil || s.mux == nil {
		return fmt.Errorf("asynq server is required")
	}

	if err := s.server.Start(s.mux); err != nil {
		return fmt.Errorf("start asynq server: %w", err)
	}

	<-ctx.Done()
	s.log.Info("asynq shutdown requested")
	return s.shutdown(ctx.Err())
}

func (s *Server) shutdown(cause error) error {
	s.server.Stop()

	done := make(chan struct{})
	go func() {
		defer close(done)
		s.server.Shutdown()
	}()

	timer := time.NewTimer(s.shutdownTimeout)
	defer timer.Stop()

	select {
	case <-done:
		s.log.Info("asynq shutdown complete")
	case <-timer.C:
		s.log.Warn("asynq shutdown timed out", "timeout", s.shutdownTimeout.String())
	}

	return cause
}

type errorLogger struct {
	log *slog.Logger
}

func (h errorLogger) HandleError(ctx context.Context, task *asynq.Task, err error) {
	log := h.log
	if log == nil {
		log = slog.Default()
	}

	retryCount, hasRetryCount := asynq.GetRetryCount(ctx)
	maxRetry, hasMaxRetry := asynq.GetMaxRetry(ctx)
	queueName, hasQueueName := asynq.GetQueueName(ctx)

	attrs := []any{
		"task_type", taskType(task),
		"payload", string(taskPayload(task)),
		"err", err,
	}
	if hasRetryCount {
		attrs = append(attrs, "retry_count", retryCount)
	}
	if hasMaxRetry {
		attrs = append(attrs, "max_retry", maxRetry)
		if hasRetryCount && retryCount >= maxRetry {
			attrs = append(attrs, "dead_lettered", true)
		}
	}
	if hasQueueName {
		attrs = append(attrs, "queue", queueName)
	}

	log.Error("asynq task failed", attrs...)
}

func taskType(task *asynq.Task) string {
	if task == nil {
		return ""
	}
	return task.Type()
}

func taskPayload(task *asynq.Task) []byte {
	if task == nil {
		return nil
	}
	return task.Payload()
}
