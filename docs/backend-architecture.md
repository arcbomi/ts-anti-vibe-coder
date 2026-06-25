# Backend Architecture

## Backend Microservice Architecture

The backend now uses a mixed microservice runtime. The browser-facing gateway and several domain services live in the Node.js workspace under `backend/nodejs`, while the remaining long-running and legacy services still live under `backend/cmd`.

```txt
backend/
  nodejs/
    services/
      api-gateway/
      auth-service/
      gitea-service/
      user-service/
      notification-service/
      relationship-service/
    packages/
      microservice-sdk/

  cmd/
    ai-analysis-service/
    question-service/
    exam-service/
    scheduler-service/

  internal/
    analysis/
    gitea/
    scheduler/

  pkg/
    sdk/
      config/
      logger/
      errors/
      database/
      queue/
      middleware/
      httpclient/
      giteaclient/
      aiclient/
```

## Service Responsibilities

### API Gateway

- Lives in `backend/nodejs/services/api-gateway`.
- Exposes the public HTTP API to the frontend.
- Routes requests to internal services through explicit proxy rules.
- Applies JWT validation, CORS handling, and safe header forwarding.

### Auth Service

- Handles login, logout, JWT issuance, and current-user authentication.
- Uses Tomorrow School signin for credential verification while continuing to issue internal JWTs.
- Calls `user-service` for user record creation, lookup, and profile data.

### User Service

- Owns the `users` table and user/profile data.
- Handles user lookup by id, email, and username.
- Exposes internal-only APIs for user creation, profile updates, public user projection, and existence checks.

### Gitea Reader Service

- Verifies that the server Gitea userbot can access a repository.
- Reads repository files after bot access is confirmed.
- Must not support personal Gitea token flow.
- Must not accept manual code uploads.

### AI Analysis Service

- Receives repository code context.
- Builds prompts and analysis requests.
- Asks AI to generate 20 English-only A/B/C/D questions.
- Enforces output structure before saving questions.

### Question Service

- Stores generated questions.
- Provides exam-safe question data without correct answers during exams.
- Stores correct answers and explanations for backend grading and result review logic.

### Exam Service

- Creates exams from completed analysis jobs.
- Receives submitted A/B/C/D answers.
- Grades exams on the backend.
- Determines pass/fail status.

### Worker Service

- Runs asynchronous jobs from the queue.
- Coordinates repository reading, indexing, AI analysis, question generation, and saving.
- Updates job status during each step.

## Queue Design

Long-running work should run through a queue instead of blocking HTTP requests.

Typical queued job flow:

1. Check bot access.
2. Read repository.
3. Index code.
4. Analyze code.
5. Generate questions.
6. Save questions.
7. Mark job completed or failed.

The queue should support retries for transient failures such as Gitea API timeouts or AI API errors. Permanent failures, such as denied bot access, should mark the job as failed with a clear error code.

## Job Status Design

Analysis jobs use these statuses:

```txt
pending
checking_bot_access
reading_repository
indexing_code
analyzing_code
generating_questions
saving_questions
completed
failed
```

The frontend can poll job status through the API Gateway and display progress to the user.

## Centralized SDK Design

All services must use the centralized SDK under `backend/pkg/sdk` for shared infrastructure.

SDK modules should include:

- `config`: environment loading and typed service config.
- `logger`: structured logging.
- `errors`: shared error codes and response mapping.
- `database`: database connection and transaction helpers.
- `queue`: queue producer and consumer helpers.
- `middleware`: auth, request ID, CORS, logging, and error middleware.
- `httpclient`: shared HTTP client settings, timeouts, and retries.
- `giteaclient`: server userbot Gitea API access.
- `aiclient`: AI provider API access.

Services should not duplicate common code for configuration, logging, database access, queue access, Gitea API calls, AI API calls, or HTTP middleware.
