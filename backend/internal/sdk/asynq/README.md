# Internal Asynq SDK

Reusable Asynq helpers for background jobs that should run outside the request lifecycle.

## Included task types

- `tomorrow.sync_projects`
- `repo.download`
- `questions.generate`
- `repo.cleanup`

## Environment

```txt
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Enqueue example

```go
package main

import (
	"context"
	"log"
	"time"

	jobs "backend/internal/sdk/asynq"
)

func main() {
	client := jobs.NewClient(jobs.RedisConfig{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	}, jobs.ClientConfig{
		Retry: jobs.RetryConfig{MaxRetry: 5},
		Timeout: jobs.TimeoutConfig{
			TaskTimeout: 10 * time.Minute,
		},
	})
	defer func() { _ = client.Close() }()

	err := client.Enqueue(
		context.Background(),
		jobs.TaskRepoDownload,
		jobs.RepoDownloadPayload{
			UserID:      "user-123",
			ProjectSlug: "go-reloaded",
			RepoURL:     "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded",
			AttemptID:   "attempt-1",
		},
		jobs.WithQueue("repositories"),
		jobs.WithUnique(30*time.Minute),
	)
	if err != nil {
		log.Fatal(err)
	}
}
```

## Worker registration example

```go
package main

import (
	"context"
	"log/slog"

	jobs "backend/internal/sdk/asynq"
	"github.com/hibiken/asynq"
)

type RepoHandler struct{}

func (h RepoHandler) Register(mux *asynq.ServeMux) {
	mux.HandleFunc(jobs.TaskRepoDownload, func(ctx context.Context, task *asynq.Task) error {
		var payload jobs.RepoDownloadPayload
		if err := jobs.DecodeTaskPayload(task, &payload); err != nil {
			return err
		}

		// Call your repository download service here.
		return nil
	})
}

func main() {
	server := jobs.NewServer(jobs.RedisConfig{
		Addr: "localhost:6379",
		DB:   0,
	}, jobs.ServerConfig{
		Concurrency: 5,
		Queues: map[string]int{
			"repositories": 1,
		},
		Logger: slog.Default(),
	}, RepoHandler{})

	if err := server.Run(context.Background()); err != nil {
		slog.Error("worker stopped", "err", err)
	}
}
```
