# Backend

This backend powers the Gitea Codebase Understanding Exam Platform. Its purpose is to verify that a user truly understands a Gitea repository by reading the repository through the platform Gitea server userbot, generating English-only A/B/C/D questions with AI, running an offline Friday exam, and grading answers on the backend as the source of truth.

The backend is intentionally split into small, independent services. Node.js services live in `backend/nodejs/services`, while the remaining Go services still live under `backend/cmd`. Shared Go infrastructure stays in `backend/pkg/sdk`, and shared Node utilities live in `backend/nodejs/packages`.

## Product rules

- Users do **not** upload code manually.
- Users do **not** provide Gitea personal access tokens.
- Users add the platform Gitea server userbot as a repository collaborator.
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
| API Gateway | `nodejs/services/api-gateway` | Public HTTP entry point, JWT validation, request forwarding, and browser-safe CORS behavior. |
| Auth Service | `nodejs/services/auth-service` | Credential verification, JWT issuance, logout, and authenticated session validation. |
| User Service | `nodejs/services/user-service` | User record storage, profile/basic info, user lookup, and internal user existence checks. |
| Gitea Service | `nodejs/services/gitea-service` | Store repository metadata, check Gitea bot access, sync Tomorrow projects, and create analysis jobs. |
| AI Analysis Service | `cmd/ai-analysis-service` | Analyze code structure and orchestrate AI generation of 20 English-only questions. |
| Question Service | `cmd/question-service` | Persist generated questions and provide exam-safe question payloads without answers. |
| Exam Service | `cmd/exam-service` | Create Friday offline exams, accept submissions, grade answers, create pass records. |
| Worker Service | `nodejs/services/worker-service` | Consume long-running analysis jobs, update status, retry failures, and dead-letter permanent failures. |

`auth-service` uses Tomorrow School signin for credential verification and then issues internal JWTs for the rest of the platform. `user-service` owns the `users` table and the internal user/profile API.

## How to run services

Run Go services from the `backend` directory. The gateway and Node services live in `backend/nodejs` and keep their own entrypoints.

```bash
cd backend/nodejs

pnpm dev:gateway
# default :8080

pnpm dev:auth
# default :3005

pnpm dev:user
# default :3002

pnpm dev:gitea
# default :8082

go run ./cmd/ai-analysis-service
# default :8083

go run ./cmd/question-service
# default :8084

go run ./cmd/exam-service
# default :8085

pnpm dev:worker
# default :3007
```

The Node gateway uses `API_GATEWAY_PORT`, `AUTH_SERVICE_BASE_URL`, `GITEA_READER_SERVICE_BASE_URL`, `QUESTION_SERVICE_BASE_URL`, and `EXAM_SERVICE_BASE_URL` to route traffic to internal services.

When `APP_ENV=development`, the Node `auth-service` ensures a local seed account exists through `user-service`. The defaults come from `.env`:

- `DEV_SEED_USER_NAME=Student User`
- `DEV_SEED_USER_EMAIL=student@example.com`
- `DEV_SEED_USER_PASSWORD=correct-password`

## Environment variables overview

| Variable | Purpose |
| --- | --- |
| `LOG_LEVEL` | Shared structured log level: `debug`, `info`, `warn`, or `error`. |
| `HTTP_PORT` | Service HTTP port. Can be overridden per service with a service prefix. |
| `POSTGRES_DSN` | PostgreSQL DSN used by services that persist data. |
| `REDIS_ADDR` | Redis address for queue workers. |
| `REDIS_PASSWORD` | Redis password when required. |
| `QUEUE_NAMESPACE` | Queue namespace for analysis jobs and dead-letter queues. |
| `GITEA_BASE_URL` | Gitea instance URL, defaulting to `https://gitea.com`. |
| `GITEA_BOT_TOKEN` | Platform Gitea server userbot token. Users must never supply their own Gitea token. |
| `GITEA_BOT_USERNAME` | Username displayed to users when asking them to add the collaborator bot. |
| `AI_BASE_URL` | AI provider base URL. |
| `AI_API_KEY` | AI provider API key. |
| `AI_MODEL` | AI model used for repository analysis and question generation. |
| `AI_TIMEOUT_SECONDS` | Timeout for AI requests. |
| `EXAM_TIMEZONE` | Timezone used to schedule offline Friday exams. |
| `EXAM_OPEN_DOW` | Day exams are available, defaulting to Friday. |
| `EXAM_PASS_PERCENT` | Passing score percentage, defaulting to 70. |
| `AUTH_JWT_HS256_SECRET` | Shared JWT/session validation secret for development and MVP deployments. |

Production deployments must load secrets from an encrypted secret manager or encrypted runtime configuration, not from plaintext checked-in files.

## Centralized SDK rule

All services must share common logic through `backend/pkg/sdk`. Do not duplicate common logic inside individual services.

Expected SDK modules:

- `pkg/sdk/config`: environment config loading, service config, database config, queue config, Gitea bot config, AI provider config.
- `pkg/sdk/logger`: structured logger, request ID support, service name support.
- `pkg/sdk/errors`: shared error type, error codes, API error response format.
- `pkg/sdk/database`: PostgreSQL connection, migration helper, transaction helper.
- `pkg/sdk/queue`: queue producer, queue consumer, retry support, dead-letter queue support.
- `pkg/sdk/middleware`: auth middleware, request logging middleware, panic recovery middleware, CORS middleware.
- `pkg/sdk/httpclient`: internal HTTP client, timeout, retry, service-to-service request helper.
- `pkg/sdk/giteaclient`: Gitea bot API client, access checks, tree reading, file reading, unsafe file filtering.
- `pkg/sdk/aiclient`: AI provider client, prompt request helper, JSON parser, retry and timeout handling.

Example imports:

```go
import "backend/pkg/sdk/config"
import "backend/pkg/sdk/logger"
import "backend/pkg/sdk/queue"
import "backend/pkg/sdk/giteaclient"
```

## Security rules

- Never ask users for Gitea personal access tokens.
- Use only the platform Gitea server userbot token for Gitea API calls.
- Encrypt sensitive config and secrets.
- Never send `.env`, private keys, `.pem` files, or tokens to AI.
- Filter unsafe files before AI analysis.
- Validate repository access before reading repository contents.
- Backend grading is the source of truth.
- Frontend never receives correct answers during active exams.
- Use least privilege for the Gitea bot account.

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
