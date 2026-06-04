# Backend Architecture

## System overview

The GitLab Codebase Understanding Exam Platform verifies whether a user understands a GitLab repository without requiring manual code upload or user-owned GitLab tokens.

The backend is a Go microservice system with:

- HTTP services for synchronous product flows.
- A queue for long-running repository analysis and AI generation jobs.
- PostgreSQL as shared persistence.
- A centralized SDK in `backend/pkg/sdk` for common infrastructure and external clients.
- A platform GitLab server userbot as the only GitLab credential used to read repositories.

High-level user flow:

```txt
User logs in
  -> submits GitLab repository URL
  -> adds platform GitLab userbot as collaborator
  -> clicks "I already added the bot"
  -> backend validates bot access
  -> backend reads safe repository files
  -> AI generates 20 English-only A/B/C/D questions
  -> user attends offline Friday exam
  -> backend grades answers
  -> passing user is marked as understanding the repository
```

## Folder structure

```txt
backend/
  README.md
  docs/
    architecture.md

  cmd/
    api-gateway/
      main.go
    auth-service/
      main.go
    gitlab-reader-service/
      main.go
    ai-analysis-service/
      main.go
    question-service/
      main.go
    exam-service/
      main.go
    worker-service/
      main.go

  internal/
    auth/
    gitlab/
    analysis/
    question/
    exam/
    worker/

  pkg/
    sdk/
      config/
      logger/
      errors/
      database/
      queue/
      middleware/
      httpclient/
      gitlabclient/
      aiclient/
```

Each `cmd/<service>/main.go` owns process startup only: load configuration, create logger, wire SDK middleware/clients, register routes, start the HTTP server or worker process, and handle graceful shutdown.

Recommended domain package structure:

```txt
internal/<domain>/
  handler.go     # HTTP request/response handling
  service.go     # business logic
  repository.go  # PostgreSQL queries and transactions
  model.go       # database/domain models
  dto.go         # request/response structs
  routes.go      # route registration
```

## Service responsibilities

### API Gateway

Public HTTP entry point for the frontend.

Responsibilities:

- Receive frontend requests.
- Validate user session through `auth-service` or shared auth middleware.
- Forward requests to internal services.
- Return unified API response and error response shapes.
- Avoid heavy business logic.

Public endpoint shape:

```txt
POST /auth/login
POST /auth/logout
GET  /me

POST /repositories
POST /repositories/:id/check-bot-access
POST /repositories/:id/start-analysis
GET  /repositories/:id

GET  /analysis-jobs/:id
GET  /analysis-jobs/:id/questions

POST /exams
GET  /exams/:id
POST /exams/:id/submit
GET  /exams/:id/result
```

### Auth Service

Authentication and session authority.

Responsibilities:

- User login.
- User logout.
- Current user session lookup.
- JWT or server-side session validation.
- Future support for Tomorrow School's own account system or Tomorrow School SSO.

### GitLab Reader Service

Repository access and ingestion using the platform GitLab server userbot.

Responsibilities:

- Accept and validate GitLab repository URLs.
- Store repository metadata.
- Check whether the server GitLab userbot has access after the user clicks **"I already added the bot"**.
- Read repository tree and important source files only after access is valid.
- Ignore unsafe or irrelevant files.
- Create analysis jobs.
- Publish analysis job messages to the queue.

Unsafe and ignored paths:

```txt
.env
*.pem
*.key
id_rsa
.git/
node_modules/
vendor/
dist/
build/
coverage/
.cache/
```

### AI Analysis Service

Code understanding and AI question generation orchestration.

Responsibilities:

- Receive repository code input from `worker-service` or a queue payload.
- Detect language and framework.
- Understand repository structure.
- Identify entry points, routes, handlers, services, stores, hooks, and database logic.
- Generate repository understanding summaries.
- Call AI question generation logic.
- Save 20 English-only A/B/C/D questions.

Question focus areas:

- Program function.
- `mux` / `net/http` usage.
- Route registration.
- Handler-to-service flow.
- Request parsing.
- Response writing.
- Error handling.
- Database usage.
- Frontend hook, store, and component flow when a frontend exists.

### Question Service

Question persistence and exam-safe delivery.

Responsibilities:

- Store AI-generated questions.
- Return questions for exams.
- Randomize question order.
- Randomize option order.
- Hide `correct_option` and `explanation` from frontend responses during active exams.

Only trusted backend services may read correct answers for grading.

### Exam Service

Exam lifecycle and grading authority.

Responsibilities:

- Create Friday offline exam sessions.
- Assign exactly 20 questions.
- Accept user answers.
- Grade answers on the backend.
- Return score and pass/fail.
- Create certificate or pass record when the user passes.

Exam rules:

- 20 questions.
- A/B/C/D only.
- English only.
- Offline every Friday.
- Passing score is configurable with `EXAM_PASS_PERCENT`, defaulting to 70%.

### Worker Service

Long-running async task processor.

Responsibilities:

- Consume analysis jobs from the queue.
- Update job status throughout the lifecycle.
- Call `gitlab-reader-service` or `pkg/sdk/gitlabclient` to fetch safe repository files.
- Call `ai-analysis-service` to perform analysis and generation.
- Retry transient failures.
- Move permanently failed jobs to the dead-letter queue.

## Service communication diagram

```txt
Frontend
  |
  v
API Gateway
  |-----------------> Auth Service
  |-----------------> GitLab Reader Service
  |-----------------> Question Service
  |-----------------> Exam Service

GitLab Reader Service
  | validates bot access with pkg/sdk/gitlabclient
  | stores repository + analysis job in PostgreSQL
  v
Queue: analysis:job
  |
  v
Worker Service
  | reads safe repository files through GitLab Reader Service or SDK
  v
AI Analysis Service
  | calls pkg/sdk/aiclient
  | saves generated questions
  v
Question Service / PostgreSQL

Exam Service
  | requests exam-safe questions from Question Service
  | grades submitted answers on backend
  v
PostgreSQL pass record
```

MVP communication choices:

- HTTP for synchronous service calls.
- Queue for long-running AI analysis.
- PostgreSQL for shared persistence.

## Queue flow

1. User submits a repository URL through the API Gateway.
2. `gitlab-reader-service` stores repository metadata with status `pending`.
3. User adds the platform GitLab userbot as collaborator.
4. User clicks **"I already added the bot"**.
5. `gitlab-reader-service` validates bot access through `pkg/sdk/gitlabclient`.
6. If access is valid, `gitlab-reader-service` creates an analysis job and enqueues `analysis:job`.
7. `worker-service` consumes the message.
8. `worker-service` updates status while reading, indexing, analyzing, generating, and saving questions.
9. Transient failures are retried.
10. Permanent failures are marked `failed` and moved to the dead-letter queue.

Queue message format:

```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "repository_id": "uuid",
  "gitlab_repo_url": "https://gitlab.com/user/project",
  "branch": "main"
}
```

## Job status lifecycle

```txt
pending
  -> checking_bot_access
  -> reading_repository
  -> indexing_code
  -> analyzing_code
  -> generating_questions
  -> saving_questions
  -> completed
```

Failure path:

```txt
any non-terminal status
  -> failed
  -> retry when transient, or dead-letter when permanently failed
```

Status definitions:

| Status | Meaning |
| --- | --- |
| `pending` | Repository or analysis job has been created but processing has not started. |
| `checking_bot_access` | Backend is verifying that the platform GitLab userbot can access the repository. |
| `reading_repository` | Safe repository tree and file content are being read. |
| `indexing_code` | Repository files are being filtered, normalized, and prepared for analysis. |
| `analyzing_code` | AI analysis service is building code understanding. |
| `generating_questions` | AI is generating 20 English-only A/B/C/D questions. |
| `saving_questions` | Generated questions are being persisted for exam use. |
| `completed` | Questions are available and the repository analysis is complete. |
| `failed` | Processing failed after retries or due to a non-retryable error. |

## SDK modules

All shared logic belongs in `backend/pkg/sdk`.

| Module | Responsibility |
| --- | --- |
| `config` | Environment loading, service config, database config, queue config, GitLab bot config, AI provider config. |
| `logger` | Structured logging, request ID support, service name support. |
| `errors` | Shared error type, error codes, API error response format. |
| `database` | PostgreSQL connection, migration helper, transaction helper. |
| `queue` | Queue producer, queue consumer, retry support, dead-letter queue support. |
| `middleware` | Auth middleware, request logging middleware, panic recovery middleware, CORS middleware. |
| `httpclient` | Shared internal HTTP client, timeout, retry, service-to-service request helper. |
| `gitlabclient` | GitLab bot API client, repository access checks, tree reading, file reading, unsafe file filtering. |
| `aiclient` | AI provider client, prompt request helper, JSON response parser, retry and timeout handling. |

Services should import SDK modules directly when they need shared behavior:

```go
import "backend/pkg/sdk/config"
import "backend/pkg/sdk/logger"
import "backend/pkg/sdk/queue"
import "backend/pkg/sdk/gitlabclient"
```

Do not copy SDK logic into service packages. If two services need the same behavior, move that behavior into the SDK.

## Data ownership guidance

PostgreSQL is shared persistence for the MVP, but ownership should still be clear:

- `auth-service` owns users and sessions.
- `gitlab-reader-service` owns repositories and repository access state.
- `ai-analysis-service` owns analysis summaries and generation metadata.
- `question-service` owns questions, options, correct answers, and explanations.
- `exam-service` owns exam sessions, submissions, scores, pass/fail state, and certificates/pass records.
- `worker-service` owns queue processing state and operational job attempts, while business status is stored with analysis jobs.

Cross-service writes should be avoided unless there is a clear ownership boundary. Prefer calling the owning service or using a repository owned by the same domain package.

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

## Exam-safe question delivery

During an active exam, `question-service` may return only:

```json
{
  "question_id": "uuid",
  "prompt": "English question text",
  "options": [
    { "label": "A", "text": "..." },
    { "label": "B", "text": "..." },
    { "label": "C", "text": "..." },
    { "label": "D", "text": "..." }
  ]
}
```

It must not return:

```txt
correct_option
explanation
raw_ai_response_with_answers
internal_grading_metadata
```

`exam-service` grades submissions by reading trusted answer data from `question-service` or PostgreSQL through backend-only code paths.

## AI safety and repository filtering

Before any content is sent to AI:

1. Validate that the platform GitLab bot has repository access.
2. Read the repository using the bot token only.
3. Remove ignored paths and unsafe files.
4. Apply size and binary-file limits.
5. Remove obvious secrets, tokens, private keys, generated artifacts, dependency folders, and cache folders.
6. Send only the minimum source context required to generate repository-understanding questions.

The AI prompt must require English-only A/B/C/D output and structured JSON that can be parsed by `pkg/sdk/aiclient`.
