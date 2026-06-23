// Package queue provides Redis-backed producer and consumer helpers for analysis jobs.
package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	analysisQueueName       = "analysis_jobs"
	analysisDeadLetterName  = "analysis_jobs:dead_letter"
	defaultMaxRetryAttempts = 3
)

// AnalysisJobMessage is the shared job payload for long-running repository analysis.
type AnalysisJobMessage struct {
	JobID        string `json:"job_id"`
	UserID       string `json:"user_id"`
	RepositoryID string `json:"repository_id"`
	GiteaRepoURL string `json:"gitea_repo_url"`
	Branch       string `json:"branch"`
	Attempt      int    `json:"attempt"`
}

func (m *AnalysisJobMessage) Validate() error {
	if m.JobID == "" || m.UserID == "" || m.RepositoryID == "" || m.GiteaRepoURL == "" {
		return fmt.Errorf("missing required analysis job fields")
	}
	if m.Branch == "" {
		m.Branch = "main"
	}
	if m.Attempt <= 0 {
		m.Attempt = 1
	}
	return nil
}

// Handler processes a consumed analysis job.
type Handler func(context.Context, AnalysisJobMessage) error

// Producer publishes analysis jobs.
type Producer struct {
	redis *redis.Client
	queue string
}

func NewProducer(redisClient *redis.Client) *Producer {
	return NewProducerWithQueue(redisClient, analysisQueueName)
}

func NewProducerWithQueue(redisClient *redis.Client, queueName string) *Producer {
	if queueName == "" {
		queueName = analysisQueueName
	}
	return &Producer{redis: redisClient, queue: queueName}
}

func (p *Producer) PublishAnalysisJob(ctx context.Context, msg AnalysisJobMessage) error {
	if p == nil || p.redis == nil {
		return fmt.Errorf("redis client is required")
	}
	if err := msg.Validate(); err != nil {
		return err
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return p.redis.LPush(ctx, p.queue, payload).Err()
}

// Consumer consumes analysis jobs and retries failures before dead-lettering.
type Consumer struct {
	redis      *redis.Client
	queue      string
	deadLetter string
	maxRetries int
	blockTime  time.Duration
}

func NewConsumer(redisClient *redis.Client) *Consumer {
	return NewConsumerWithOptions(redisClient, analysisQueueName, analysisDeadLetterName, defaultMaxRetryAttempts)
}

func NewConsumerWithOptions(redisClient *redis.Client, queueName string, deadLetterName string, maxAttempts int) *Consumer {
	if queueName == "" {
		queueName = analysisQueueName
	}
	if deadLetterName == "" {
		deadLetterName = analysisDeadLetterName
	}
	if maxAttempts <= 0 {
		maxAttempts = defaultMaxRetryAttempts
	}
	return &Consumer{
		redis:      redisClient,
		queue:      queueName,
		deadLetter: deadLetterName,
		maxRetries: maxAttempts,
		blockTime:  5 * time.Second,
	}
}

func (c *Consumer) ConsumeAnalysisJobs(ctx context.Context, handler Handler) error {
	if c == nil || c.redis == nil {
		return fmt.Errorf("redis client is required")
	}
	if handler == nil {
		return fmt.Errorf("analysis job handler is required")
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		result, err := c.redis.BRPop(ctx, c.blockTime, c.queue).Result()
		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return err
			}
			return err
		}
		if len(result) != 2 {
			continue
		}
		if err := c.handlePayload(ctx, result[1], handler); err != nil {
			return err
		}
	}
}

func (c *Consumer) handlePayload(ctx context.Context, payload string, handler Handler) error {
	var msg AnalysisJobMessage
	if err := json.Unmarshal([]byte(payload), &msg); err != nil {
		return c.redis.LPush(ctx, c.deadLetter, payload).Err()
	}
	if err := handler(ctx, msg); err == nil {
		return nil
	}
	msg.Attempt++
	b, marshalErr := json.Marshal(msg)
	if marshalErr != nil {
		return marshalErr
	}
	if msg.Attempt > c.maxRetries {
		return c.redis.LPush(ctx, c.deadLetter, b).Err()
	}
	return c.redis.LPush(ctx, c.queue, b).Err()
}

// RedisConfig contains shared Redis connection settings.
type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

func NewRedisClient(cfg RedisConfig) *redis.Client {
	return redis.NewClient(&redis.Options{Addr: cfg.Addr, Password: cfg.Password, DB: cfg.DB})
}

// Client preserves the early SDK producer API while newer code can use Producer/Consumer.
type Client struct {
	producer *Producer
}

func NewClient(rc RedisConfig, namespace string) *Client {
	return &Client{producer: NewProducerWithQueue(NewRedisClient(rc), namespace)}
}

func (c *Client) Close() error {
	if c == nil || c.producer == nil || c.producer.redis == nil {
		return nil
	}
	return c.producer.redis.Close()
}

func (c *Client) EnqueueAnalysisJob(msg AnalysisJobMessage) error {
	return c.producer.PublishAnalysisJob(context.Background(), msg)
}
