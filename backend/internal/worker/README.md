# Worker Service

The worker service consumes queued GitLab repository analysis jobs and runs the long repository-reading and AI-question-generation flow outside of the API request lifecycle.

## Why a queue is needed

Repository reads and AI analysis can take longer than a normal HTTP request should remain open. The API creates an `analysis_jobs` row, publishes a JSON message to Redis, and returns quickly. The worker later consumes the message, updates progress in PostgreSQL, and saves generated exam questions.

## Queue message

Messages are JSON objects with this shape:

```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "repository_id": "uuid",
  "gitlab_repo_url": "https://gitlab.com/user/project",
  "branch": "main",
  "attempt": 1
}
```

## Job status lifecycle

The worker updates `analysis_jobs.status` through these values:

1. `pending`
2. `checking_bot_access`
3. `reading_repository`
4. `indexing_code`
5. `analyzing_code`
6. `generating_questions`
7. `saving_questions`
8. `completed`
9. `failed` when a permanent error occurs or retries are exhausted

## Repository safety filter

The worker never sends unsafe or unnecessary files to AI. It skips `.env`, `*.pem`, `*.key`, `id_rsa`, `.git/`, `node_modules/`, `vendor/`, `dist/`, `build/`, `coverage/`, `.cache/`, binary files, hidden files that are not useful for code understanding, and files larger than 300 KB.

## Retry rules

Only temporary failures are retried. Examples include GitLab network errors, AI request timeouts, Redis/queue issues, and transient database errors. Permanent failures such as `BOT_ACCESS_DENIED`, `INVALID_REPOSITORY_URL`, `REPOSITORY_NOT_FOUND`, and invalid AI output are not retried.

The default retry policy is:

- `MAX_JOB_ATTEMPTS=3`
- `RETRY_DELAY_SECONDS=30`

## Dead-letter behavior

When a permanent failure occurs, or when a retryable failure exhausts all attempts, the worker marks `analysis_jobs.status = failed`, stores an error code/message, and pushes the original message to `ANALYSIS_DEAD_LETTER_QUEUE_NAME` for later inspection.

## Running locally

From the repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.infra.yml up postgres redis worker-service
```

Or run directly from the Go module:

```bash
cd backend
go run ./cmd/worker-service
```

## Required environment variables

```txt
WORKER_CONCURRENCY=3
QUEUE_URL=redis://localhost:6379
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
ANALYSIS_QUEUE_NAME=analysis_jobs
ANALYSIS_DEAD_LETTER_QUEUE_NAME=analysis_jobs_dead
MAX_JOB_ATTEMPTS=3
RETRY_DELAY_SECONDS=30
DATABASE_URL=postgres://user:password@localhost:5432/app
GITLAB_BASE_URL=https://gitlab.com
GITLAB_BOT_TOKEN=xxx
AI_BASE_URL=https://api.openai.com
AI_API_KEY=xxx
AI_MODEL=gpt-4.1-mini
AI_TIMEOUT_SECONDS=60
```
