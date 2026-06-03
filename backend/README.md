# Go Backend

This backend powers the GitLab Codebase Understanding Exam Platform. Its purpose is to verify that a user truly understands a GitLab repository by reading the repository through the platform GitLab server userbot, generating English-only A/B/C/D questions with AI, running an offline Saturday exam, and grading answers on the backend as the source of truth.

The backend is intentionally split into small, independent Go programs under `backend/cmd`. Shared infrastructure, clients, configuration, logging, middleware, error handling, database access, queue access, GitLab access, and AI access must live in the centralized SDK under `backend/pkg/sdk`.

## Product rules

- Users do **not** upload code manually.
- Users do **not** provide GitLab personal access tokens.
- Users add the platform GitLab server userbot as a repository collaborator.
- Users must click **"I already added the bot"** before the backend checks repository access.
- The backend must validate bot access before reading repository contents.
- AI-generated questions must be English only.
- There is no admin question review flow in the MVP.
- The frontend must never receive `correct_option` or `explanation` during an active exam.
- Backend grading is the source of truth.

## Microservices

Each service is independently runnable, independently deployable, independently testable, and small enough to have one clear responsibility.

| Service | Path | Responsibility |
| --- | --- | --- |
| API Gateway | `cmd/api-gateway` | Public HTTP entry point, session validation, request forwarding, unified API responses. |
| Auth Service | `cmd/auth-service` | Login, logout, current user lookup, JWT/session validation. |
| GitLab Reader Service | `cmd/gitlab-reader-service` | Store repository metadata, check GitLab bot access, read safe repository files, create analysis jobs. |
| AI Analysis Service | `cmd/ai-analysis-service` | Analyze code structure and orchestrate AI generation of 20 English-only questions. |
| Question Service | `cmd/question-service` | Persist generated questions and provide exam-safe question payloads without answers. |
| Exam Service | `cmd/exam-service` | Create Saturday offline exams, accept submissions, grade answers, create pass records. |
| Worker Service | `cmd/worker-service` | Consume long-running analysis jobs, update status, retry failures, dead-letter permanent failures. |

In the future, `auth-service` should support Tomorrow School's own account system or Tomorrow School SSO.

## How to run services

Run commands from the `backend` directory. Each service exposes a `/healthz` endpoint and gets its default port from `pkg/sdk/config`.

```bash
cd backend

go run ./cmd/api-gateway
# default :8080

go run ./cmd/auth-service
# default :8081

go run ./cmd/gitlab-reader-service
# default :8082

go run ./cmd/ai-analysis-service
# default :8083

go run ./cmd/question-service
# default :8084

go run ./cmd/exam-service
# default :8085

go run ./cmd/worker-service
# default :8087
```

Service-specific environment variables can override shared values by prefixing the variable with the service name in uppercase snake case. For example, `API_GATEWAY_HTTP_PORT=9000` overrides `HTTP_PORT` only for `api-gateway`.

## Environment variables overview

| Variable | Purpose |
| --- | --- |
| `LOG_LEVEL` | Shared structured log level: `debug`, `info`, `warn`, or `error`. |
| `HTTP_PORT` | Service HTTP port. Can be overridden per service with a service prefix. |
| `POSTGRES_DSN` | PostgreSQL DSN used by services that persist data. |
| `REDIS_ADDR` | Redis address for queue workers. |
| `REDIS_PASSWORD` | Redis password when required. |
| `QUEUE_NAMESPACE` | Queue namespace for analysis jobs and dead-letter queues. |
| `GITLAB_BASE_URL` | GitLab instance URL, defaulting to `https://gitlab.com`. |
| `GITLAB_BOT_TOKEN` | Platform GitLab server userbot token. Users must never supply their own GitLab token. |
| `GITLAB_BOT_USERNAME` | Username displayed to users when asking them to add the collaborator bot. |
| `AI_BASE_URL` | AI provider base URL. |
| `AI_API_KEY` | AI provider API key. |
| `AI_MODEL` | AI model used for repository analysis and question generation. |
| `AI_TIMEOUT_SECONDS` | Timeout for AI requests. |
| `EXAM_TIMEZONE` | Timezone used to schedule offline Saturday exams. |
| `EXAM_OPEN_DOW` | Day exams are available, defaulting to Saturday. |
| `EXAM_PASS_PERCENT` | Passing score percentage, defaulting to 70. |
| `AUTH_JWT_HS256_SECRET` | Shared JWT/session validation secret for development and MVP deployments. |

Production deployments must load secrets from an encrypted secret manager or encrypted runtime configuration, not from plaintext checked-in files.

## Centralized SDK rule

All services must share common logic through `backend/pkg/sdk`. Do not duplicate common logic inside individual services.

Expected SDK modules:

- `pkg/sdk/config`: environment config loading, service config, database config, queue config, GitLab bot config, AI provider config.
- `pkg/sdk/logger`: structured logger, request ID support, service name support.
- `pkg/sdk/errors`: shared error type, error codes, API error response format.
- `pkg/sdk/database`: PostgreSQL connection, migration helper, transaction helper.
- `pkg/sdk/queue`: queue producer, queue consumer, retry support, dead-letter queue support.
- `pkg/sdk/middleware`: auth middleware, request logging middleware, panic recovery middleware, CORS middleware.
- `pkg/sdk/httpclient`: internal HTTP client, timeout, retry, service-to-service request helper.
- `pkg/sdk/gitlabclient`: GitLab bot API client, access checks, tree reading, file reading, unsafe file filtering.
- `pkg/sdk/aiclient`: AI provider client, prompt request helper, JSON parser, retry and timeout handling.

Example imports:

```go
import "backend/pkg/sdk/config"
import "backend/pkg/sdk/logger"
import "backend/pkg/sdk/queue"
import "backend/pkg/sdk/gitlabclient"
```

## Security rules

- Never ask users for GitLab personal access tokens.
- Use only the platform GitLab server userbot token for GitLab API calls.
- Encrypt sensitive config and secrets.
- Never send `.env`, private keys, `.pem` files, or tokens to AI.
- Filter unsafe files before AI analysis.
- Validate repository access before reading repository contents.
- Backend grading is the source of truth.
- Frontend never receives correct answers during active exams.
- Use least privilege for the GitLab bot account.

## Development boundaries

Recommended domain package layout:

```txt
internal/<domain>/
  handler.go     # HTTP request/response handling
  service.go     # business logic
  repository.go  # database logic
  model.go       # database/domain models
  dto.go         # request/response structs
  routes.go      # route registration
```

Keep service-specific domain code under `backend/internal/<domain>`. Move reusable code to `backend/pkg/sdk` before a second service needs it.
