package asynqsdk

import (
	"time"

	"github.com/hibiken/asynq"
)

// Option configures an individual task enqueue call.
type Option = asynq.Option

func WithQueue(name string) Option {
	return asynq.Queue(name)
}

func WithMaxRetry(maxRetry int) Option {
	return asynq.MaxRetry(maxRetry)
}

func WithTimeout(timeout time.Duration) Option {
	return asynq.Timeout(timeout)
}

func WithProcessIn(delay time.Duration) Option {
	return asynq.ProcessIn(delay)
}

func WithTaskID(taskID string) Option {
	return asynq.TaskID(taskID)
}

// WithUnique makes enqueued jobs idempotent for the given de-duplication window.
func WithUnique(ttl time.Duration) Option {
	if ttl <= 0 {
		ttl = defaultUniqueTaskTTL
	}
	return asynq.Unique(ttl)
}
