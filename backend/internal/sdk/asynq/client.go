package asynqsdk

import (
	"context"
	"fmt"

	"github.com/hibiken/asynq"
)

type Client struct {
	client         *asynq.Client
	defaultOptions []Option
}

type ClientConfig struct {
	Retry   RetryConfig
	Timeout TimeoutConfig
}

func (c ClientConfig) normalize() ClientConfig {
	c.Retry = c.Retry.normalize()
	c.Timeout = c.Timeout.normalize()
	return c
}

func NewClient(redisConfig RedisConfig, cfg ClientConfig) *Client {
	cfg = cfg.normalize()
	return &Client{
		client: asynq.NewClient(redisConfig.asynq()),
		defaultOptions: []Option{
			asynq.MaxRetry(cfg.Retry.MaxRetry),
			asynq.Timeout(cfg.Timeout.TaskTimeout),
		},
	}
}

func (c *Client) Close() error {
	if c == nil || c.client == nil {
		return nil
	}
	return c.client.Close()
}

func (c *Client) Enqueue(ctx context.Context, taskName string, payload any, opts ...Option) error {
	if c == nil || c.client == nil {
		return fmt.Errorf("asynq client is required")
	}
	task, err := NewTask(taskName, payload)
	if err != nil {
		return err
	}
	_, err = c.client.EnqueueContext(ctx, task, append(c.defaultOptions, opts...)...)
	if err != nil {
		return fmt.Errorf("enqueue task %q: %w", taskName, err)
	}
	return nil
}
