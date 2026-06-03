package worker

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type ConsumerConfig struct {
	QueueName       string
	DeadLetterQueue string
	Concurrency     int
	Retry           RetryConfig
	BlockTimeout    time.Duration
}

type Consumer struct {
	redis   *redis.Client
	handler *Handler
	cfg     ConsumerConfig
	log     *slog.Logger
}

func NewConsumer(redisClient *redis.Client, handler *Handler, cfg ConsumerConfig, log *slog.Logger) *Consumer {
	if cfg.QueueName == "" {
		cfg.QueueName = "analysis_jobs"
	}
	if cfg.DeadLetterQueue == "" {
		cfg.DeadLetterQueue = "analysis_jobs_dead"
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 3
	}
	if cfg.BlockTimeout <= 0 {
		cfg.BlockTimeout = 5 * time.Second
	}
	cfg.Retry = cfg.Retry.normalized()
	return &Consumer{redis: redisClient, handler: handler, cfg: cfg, log: log}
}

func (c *Consumer) Run(ctx context.Context) error {
	if c.redis == nil {
		return NewRetryableError(ErrCodeQueue, "redis client is required", nil)
	}
	if c.handler == nil {
		return NewPermanentError(ErrCodeQueue, "worker handler is required", nil)
	}
	var wg sync.WaitGroup
	for i := 0; i < c.cfg.Concurrency; i++ {
		wg.Add(1)
		go func(workerID int) { defer wg.Done(); c.consumeLoop(ctx, workerID) }(i + 1)
	}
	<-ctx.Done()
	wg.Wait()
	return ctx.Err()
}

func (c *Consumer) consumeLoop(ctx context.Context, workerID int) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		result, err := c.redis.BRPop(ctx, c.cfg.BlockTimeout, c.cfg.QueueName).Result()
		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return
			}
			c.log.Error("queue consume failed", "worker_id", workerID, "err", err)
			time.Sleep(time.Second)
			continue
		}
		if len(result) != 2 {
			continue
		}
		c.processPayload(ctx, []byte(result[1]), workerID)
	}
}

func (c *Consumer) processPayload(ctx context.Context, payload []byte, workerID int) {
	result := c.handler.Handle(ctx, payload)
	msg := result.Message
	if result.Err == nil {
		return
	}
	log := c.log.With("worker_id", workerID, "job_id", msg.JobID, "user_id", msg.UserID, "repository_id", msg.RepositoryID, "status", StatusFailed, "attempt", msg.Attempt)
	if IsRetryable(result.Err) && msg.Attempt < c.cfg.Retry.MaxAttempts {
		msg.Attempt++
		log.Info("retry scheduled", "next_attempt", msg.Attempt, "delay", c.cfg.Retry.Delay.String(), "error_code", ErrorCode(result.Err), "err", result.Err)
		select {
		case <-ctx.Done():
			return
		case <-time.After(c.cfg.Retry.Delay):
		}
		c.requeueOrDeadLetter(ctx, msg, payload, log)
		return
	}
	if msg.JobID != "" {
		_ = c.handler.store.FailAnalysisJob(ctx, msg.JobID, ErrorCode(result.Err), ErrorMessage(result.Err))
	}
	c.deadLetter(ctx, msg, payload, log, result.Err)
}

func (c *Consumer) requeueOrDeadLetter(ctx context.Context, msg AnalysisJobMessage, original []byte, log *slog.Logger) {
	payload, err := json.Marshal(msg)
	if err != nil {
		c.deadLetter(ctx, msg, original, log, err)
		return
	}
	if err := c.redis.LPush(ctx, c.cfg.QueueName, payload).Err(); err != nil {
		c.deadLetter(ctx, msg, payload, log, NewRetryableError(ErrCodeQueue, "failed to requeue analysis job", err))
		return
	}
}

func (c *Consumer) deadLetter(ctx context.Context, msg AnalysisJobMessage, payload []byte, log *slog.Logger, cause error) {
	if err := c.redis.LPush(ctx, c.cfg.DeadLetterQueue, payload).Err(); err != nil {
		log.Error("dead-letter message failed", "error_code", ErrCodeQueue, "err", err, "cause", cause)
		return
	}
	log.Info("dead-letter message created", "error_code", ErrorCode(cause), "err", cause)
}
