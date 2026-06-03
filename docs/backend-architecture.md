# Backend Architecture

## Go Microservice Architecture

The backend is built with Go microservices. Each service is a different Go program under `backend/cmd`, and each service owns a focused part of the platform.

```txt
backend/
  cmd/
    api-gateway/
    auth-service/
    gitlab-reader-service/
    ai-analysis-service/
    question-service/
    exam-service/
    worker-service/

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

## Service Responsibilities

### API Gateway

- Exposes the public HTTP API to the frontend.
- Handles request routing to internal services.
- Applies shared middleware such as authentication, logging, CORS, and error formatting.
- Ensures browser clients do not call internal services directly.

### Auth Service

- Handles login, logout, and current-user lookup.
- Owns user identity and session/token behavior.
- Should later support Tomorrow School account login or Tomorrow School SSO.

### GitLab Reader Service

- Verifies that the server GitLab userbot can access a repository.
- Reads repository files after bot access is confirmed.
- Must not support personal GitLab token flow.
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

The queue should support retries for transient failures such as GitLab API timeouts or AI API errors. Permanent failures, such as denied bot access, should mark the job as failed with a clear error code.

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
- `gitlabclient`: server userbot GitLab API access.
- `aiclient`: AI provider API access.

Services should not duplicate common code for configuration, logging, database access, queue access, GitLab API calls, AI API calls, or HTTP middleware.
