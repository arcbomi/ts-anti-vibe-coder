# Integration testing

This project uses integration tests to verify the connected GitLab Codebase Understanding Exam Platform flow. These tests are not unit tests: they exercise HTTP handlers, PostgreSQL persistence, Redis queueing, worker job processing, fake GitLab boundary APIs, and fake AI boundary APIs together.

## Commands

### Backend

```bash
./backend/scripts/run-integration-tests.sh
```

The backend script runs:

```bash
go test -count=1 -tags=integration ./tests/integration
```

### Frontend

```bash
./frontend/scripts/run-integration-tests.sh
```

The frontend script expects Vitest, jsdom, and Testing Library dev dependencies to be installed, then runs:

```bash
vitest run "tests/integration/**/*.integration.test.tsx" --environment jsdom
```

If the package registry is unavailable, install those dependencies when network policy allows it, then rerun the script.

## Required backend environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `TEST_DATABASE_URL` | PostgreSQL database used only for integration tests. Falls back to `DATABASE_URL` if omitted. | `postgres://postgres:postgres@localhost:5432/anti_vibe_test?sslmode=disable` |
| `TEST_REDIS_ADDR` | Redis queue used only for integration tests. Falls back to `REDIS_ADDR`, then `localhost:6379`. | `localhost:6379` |
| `TEST_REDIS_PASSWORD` | Optional Redis password for the test queue. | empty for local Redis |

The backend tests create the needed schema and reset test tables before each test app instance. Use a disposable database because integration setup drops platform tables in the configured test database.

## Required test database

Use a real PostgreSQL database. The backend integration harness creates the `pgcrypto` extension, auth users table, repositories, analysis jobs, generated questions, exam questions, exams, and exam answers. The tests verify that data is actually persisted and later loaded by other services.

## Required test queue

Use a real Redis instance. Repository analysis startup publishes an `analysis_jobs` message to Redis. The integration worker test pops that real message and processes it through the worker handler and job runner.

## Fake GitLab server

`backend/tests/integration/fake_gitlab_server.go` starts an `httptest.Server` that simulates the external GitLab API boundary only. It does not fake internal platform services.

It supports:

- bot token authenticated project metadata lookup;
- access granted and access denied modes;
- repository tree responses;
- raw file content responses.

The fake repository contains real Go source examples: `go.mod`, `cmd/server/main.go`, `internal/server/router.go`, `internal/handler/user_handler.go`, and `internal/service/user_service.go`. Those files include net/http server setup, mux route registration, request parsing, JSON response writing, and handler-to-service calls.

## Fake AI server

`backend/tests/integration/fake_ai_server.go` starts an OpenAI-compatible fake boundary server. It responds to `/v1/chat/completions` and returns:

- repository analysis JSON for the first worker AI call;
- exactly 20 English-only A/B/C/D questions for the second worker AI call;
- one correct option, explanation, difficulty, and source file path per question.

The same fake can be switched into invalid JSON mode to verify that worker processing marks an analysis job as failed and stores the error message.

## Covered flows

Backend integration tests cover:

1. user registration/login and `/auth/me` with a real JWT;
2. invalid login using the shared `{ success, data, error }` envelope;
3. repository URL submission with no personal GitLab token;
4. server GitLab userbot access checks through the fake GitLab API;
5. bot access denied errors with `BOT_ACCESS_DENIED`;
6. analysis job creation in PostgreSQL;
7. Redis queue job creation;
8. worker consumption of the queued job;
9. repository reading through fake GitLab;
10. AI analysis and 20-question generation through fake AI;
11. completed and failed analysis status persistence;
12. question persistence for later exams;
13. active exam question loading without `correct_option` or `explanation`;
14. exam submission, backend grading, score calculation, and pass/fail results.

Frontend integration tests cover user-facing behavior:

1. login page submission, API interaction, token storage, and dashboard redirect;
2. repository URL entry, bot instruction display, “I already added the bot” API call, access granted state, and access denied error display;
3. rendering every analysis lifecycle status from backend state;
4. rendering 20 exam questions and A/B/C/D options, selecting answers, submitting to the backend API, and ensuring answer keys/explanations are not rendered before submission.

## Intentionally not tested

These integration tests intentionally do not cover:

- tiny helper functions in isolation;
- password hashing internals beyond login working end-to-end;
- prompt wording unit assertions;
- individual repository file filter edge cases;
- admin question review, because generated questions are used directly by product design;
- real GitLab.com or real AI provider calls, because those are replaced only at the external boundary by fake servers;
- visual screenshot regression testing.

## Smoke tests

Smoke tests provide a fast post-deployment check that the main system is alive and usable. They intentionally avoid deep business-logic verification and should complete quickly.

Run them from the repository root after deploying the backend services, worker, frontend, PostgreSQL, and Redis:

```bash
./scripts/run-smoke-tests.sh
# or
make smoke-test
```

The script loads `.env` when it exists, then runs:

```bash
go test -count=1 -tags=smoke ./tests/smoke
```

### Smoke test coverage

The smoke suite checks:

1. every backend service `/healthz` endpoint responds successfully;
2. the API gateway `/healthz` endpoint responds successfully;
3. the worker `/healthz` endpoint responds successfully;
4. the frontend root page returns a successful HTTP response;
5. the exam route can be opened by the frontend server;
6. PostgreSQL accepts a quick ping;
7. Redis accepts a quick ping;
8. required AI client configuration exists and is not a placeholder;
9. required GitLab bot configuration exists and is not a placeholder;
10. a basic repository create request receives a fast validation response instead of a server error.

### Smoke test URL overrides

By default, the suite targets local development ports from `.env.example`. Override these variables for a deployed environment:

| Variable | Default |
| --- | --- |
| `SMOKE_FRONTEND_URL` | `http://localhost:5173` |
| `SMOKE_API_GATEWAY_URL` | `http://localhost:8080` |
| `SMOKE_AUTH_SERVICE_URL` | `http://localhost:8081` |
| `SMOKE_GITLAB_READER_SERVICE_URL` | `http://localhost:8082` |
| `SMOKE_AI_ANALYSIS_SERVICE_URL` | `http://localhost:8083` |
| `SMOKE_QUESTION_SERVICE_URL` | `http://localhost:8084` |
| `SMOKE_EXAM_SERVICE_URL` | `http://localhost:8085` |
| `SMOKE_SCHEDULER_SERVICE_URL` | `http://localhost:8086` |
| `SMOKE_WORKER_SERVICE_URL` | `http://localhost:8087` |

The database, queue, AI, and GitLab checks use the normal service configuration variables, including `DATABASE_URL`, `QUEUE_URL` or `REDIS_ADDR`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `GITLAB_BASE_URL`, `GITLAB_BOT_TOKEN`, and `GITLAB_BOT_USERNAME`.
