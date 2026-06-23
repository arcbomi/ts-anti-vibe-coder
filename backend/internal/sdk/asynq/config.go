package asynqsdk

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/hibiken/asynq"
)

const (
	DefaultQueueName     = "default"
	defaultRedisAddr     = "localhost:6379"
	defaultJobRetry      = 3
	defaultJobTimeout    = 5 * time.Minute
	defaultWorkerTimeout = 10 * time.Second
	defaultWorkerCount   = 10
	defaultUniqueTaskTTL = 10 * time.Minute
)

// RedisConfig contains the environment-driven Redis connection settings.
type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

func LoadRedisConfigFromEnv() (RedisConfig, error) {
	db := 0
	if raw := os.Getenv("REDIS_DB"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			return RedisConfig{}, fmt.Errorf("invalid REDIS_DB: %w", err)
		}
		db = parsed
	}

	return RedisConfig{
		Addr:     os.Getenv("REDIS_ADDR"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       db,
	}.normalize(), nil
}

func (c RedisConfig) normalize() RedisConfig {
	if c.Addr == "" {
		c.Addr = defaultRedisAddr
	}
	return c
}

func (c RedisConfig) asynq() asynq.RedisClientOpt {
	c = c.normalize()
	return asynq.RedisClientOpt{
		Addr:     c.Addr,
		Password: c.Password,
		DB:       c.DB,
	}
}

// RetryConfig holds default task retry settings.
type RetryConfig struct {
	MaxRetry int
}

func (c RetryConfig) normalize() RetryConfig {
	if c.MaxRetry < 0 {
		c.MaxRetry = 0
	}
	if c.MaxRetry == 0 {
		c.MaxRetry = defaultJobRetry
	}
	return c
}

// TimeoutConfig holds default task timeout settings.
type TimeoutConfig struct {
	TaskTimeout     time.Duration
	ShutdownTimeout time.Duration
}

func (c TimeoutConfig) normalize() TimeoutConfig {
	if c.TaskTimeout <= 0 {
		c.TaskTimeout = defaultJobTimeout
	}
	if c.ShutdownTimeout <= 0 {
		c.ShutdownTimeout = defaultWorkerTimeout
	}
	return c
}

// ServerConfig configures the Asynq worker wrapper.
type ServerConfig struct {
	Concurrency    int
	Queues         map[string]int
	StrictPriority bool
	RetryDelayFunc asynq.RetryDelayFunc
	Retry          RetryConfig
	Timeout        TimeoutConfig
	Logger         *slog.Logger
}

func (c ServerConfig) normalize() ServerConfig {
	if c.Concurrency <= 0 {
		c.Concurrency = defaultWorkerCount
	}
	if len(c.Queues) == 0 {
		c.Queues = map[string]int{DefaultQueueName: 1}
	}
	c.Retry = c.Retry.normalize()
	c.Timeout = c.Timeout.normalize()
	return c
}
