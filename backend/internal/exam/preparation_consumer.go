package exam

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

type RepoDownloadConsumer struct {
	redis      *redis.Client
	queue      string
	deadLetter string
	maxRetries int
	delay      time.Duration
	processor  *RepoDownloadProcessor
	log        *slog.Logger
}

func NewRepoDownloadConsumer(redisClient *redis.Client, queueName, deadLetterName string, maxRetries int, delay time.Duration, processor *RepoDownloadProcessor, log *slog.Logger) *RepoDownloadConsumer {
	if queueName == "" {
		queueName = "repo_download_jobs"
	}
	if deadLetterName == "" {
		deadLetterName = "repo_download_jobs_dead"
	}
	if maxRetries <= 0 {
		maxRetries = 3
	}
	if delay <= 0 {
		delay = time.Second
	}
	if log == nil {
		log = slog.Default()
	}
	return &RepoDownloadConsumer{
		redis:      redisClient,
		queue:      queueName,
		deadLetter: deadLetterName,
		maxRetries: maxRetries,
		delay:      delay,
		processor:  processor,
		log:        log,
	}
}

func (c *RepoDownloadConsumer) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		result, err := c.redis.BRPop(ctx, 5*time.Second, c.queue).Result()
		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return err
			}
			c.log.Error("repo download consume failed", "err", err)
			time.Sleep(time.Second)
			continue
		}
		if len(result) != 2 {
			continue
		}
		c.process(ctx, []byte(result[1]))
	}
}

func (c *RepoDownloadConsumer) process(ctx context.Context, payload []byte) {
	var msg RepoDownloadJobMessage
	if err := json.Unmarshal(payload, &msg); err != nil {
		_ = c.redis.LPush(ctx, c.deadLetter, payload).Err()
		return
	}
	if err := c.processor.Process(ctx, msg); err != nil {
		msg.Attempt++
		body, marshalErr := json.Marshal(msg)
		if marshalErr != nil || msg.Attempt > c.maxRetries {
			_ = c.redis.LPush(ctx, c.deadLetter, payload).Err()
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(c.delay):
		}
		_ = c.redis.LPush(ctx, c.queue, body).Err()
	}
}
