# GitLab Codebase Understanding Exam Platform

The GitLab Codebase Understanding Exam Platform verifies whether a user truly understands a GitLab repository instead of only being able to produce code with AI assistance.

The platform does not ask users to upload code manually and does not ask for a personal GitLab token. Instead, the user adds the platform's **server GitLab userbot** as a collaborator to their GitLab repository, then clicks **"I already added the bot"**. The backend checks bot access, reads the repository automatically, sends the codebase to AI analysis, and creates an offline exam.

## Product Flow

1. User logs in to the platform.
2. User enters a GitLab repository URL.
3. Platform instructs the user to add the GitLab server userbot as a repository collaborator.
4. User adds the bot in GitLab.
5. User clicks **"I already added the bot"**.
6. Backend checks whether the bot can access the repository.
7. Backend automatically reads the repository after access is confirmed.
8. AI analyzes the repository code.
9. AI generates **20 English-only A/B/C/D questions**.
10. User attends the offline Friday exam at the assigned location.
11. User answers the questions offline.
12. Backend grades the exam.
13. If the user passes, the system marks that the user understands the repository code.

## Important Product Rules

- Users do not upload code manually.
- Users do not provide a personal GitLab token.
- Users add the platform's GitLab server userbot as a repository collaborator.
- Users must click **"I already added the bot"** before the backend checks access.
- The system reads the repository automatically only after bot access is confirmed.
- AI generates exactly **20 English-only A/B/C/D questions**.
- There is **no admin review** of questions; AI-generated questions are used directly.
- The offline exam happens on Friday at a specific location.
- Backend grading is the source of truth.
- The frontend must never receive correct answers during the exam.

## Backend Architecture

The backend uses **Go microservices**. Each service is a separate Go program under `backend/cmd`:

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
```

All backend services must share common infrastructure through the centralized SDK under `backend/pkg/sdk`. Shared logic such as configuration, logging, database access, queues, middleware, HTTP clients, GitLab client code, and AI client code must live in the SDK instead of being duplicated inside services.

The auth service should later support Tomorrow School account login or Tomorrow School SSO.

## Frontend Architecture

The frontend uses **React + Vite + TypeScript** with a domain-separated architecture:

```txt
frontend/
  src/
    app/
    pages/
    domains/
      auth/
      repository/
      analysis/
      question/
      exam/
    shared/
```

Each domain owns its own API functions, hooks, store, components, page sections, types, and README. Pages under `src/pages/` should only compose domain page sections and must not contain heavy business logic.

## Documentation

- [Product requirements](docs/product-requirements.md)
- [API contract](docs/api-contract.md)
- [Backend architecture](docs/backend-architecture.md)
- [Frontend architecture](docs/frontend-architecture.md)
- [AI question rules](docs/ai-question-rules.md)
- [Deployment](docs/deployment.md)

## Running the Whole Platform Locally

### Prerequisites

- Docker and Docker Compose v2 for the one-command development stack.
- Go 1.24+ if you want to run backend services directly on your host.
- Node.js 24+ and npm if you want to run the frontend directly on your host.

### Environment setup

Create a local environment file from the checked-in example:

```bash
cp .env.example .env
```

The defaults are enough to boot the local stack. Replace `GITLAB_BOT_TOKEN`, `GITLAB_BOT_USERNAME`, `AI_API_KEY`, `AUTH_JWT_HS256_SECRET`, and `INTERNAL_SERVICE_TOKEN` before running a real GitLab/AI-backed workflow or deploying the platform.

### One-command local development

Start PostgreSQL, Redis, all backend services, the worker, database migrations, and the Vite frontend with one command:

```bash
make dev
```

This command calls `./scripts/dev-up.sh`, creates `.env` from `.env.example` when needed, and runs `docker compose -f docker-compose.yml -f docker-compose.infra.yml up --build`. The frontend is available at <http://localhost:5173>. Backend health checks are exposed at:

| Component | URL |
| --- | --- |
| API Gateway | <http://localhost:8080/healthz> |
| Auth Service | <http://localhost:8081/healthz> |
| GitLab Reader Service | <http://localhost:8082/healthz> |
| AI Analysis Service | <http://localhost:8083/healthz> |
| Question Service | <http://localhost:8084/healthz> |
| Exam Service | <http://localhost:8085/healthz> |
| Scheduler Service | <http://localhost:8086/healthz> |
| Worker Service | <http://localhost:8087/healthz> |

Stop the local stack with:

```bash
make dev-down
```

### Database migrations

Run all pending database migrations with one command:

```bash
make migrate
```

The command uses `DATABASE_URL` from `.env` and runs `go run ./cmd/migrate up` from the backend. Migration files live in `backend/migrations`, and applied versions are tracked in the `schema_migrations` table.

### Running services directly on your host

When PostgreSQL and Redis are already running, you can run individual components without Docker:

```bash
make backend-run-api
make backend-run-auth
make backend-run-gitlab
make backend-run-analysis
make backend-run-question
make backend-run-exam
make backend-run-scheduler
make backend-run-worker
make frontend-dev
```

You can also run any backend service by name:

```bash
./scripts/run-backend.sh auth-service
./scripts/run-backend.sh worker-service
```

### Tests and checks

Run backend unit tests:

```bash
make backend-test
```

Run backend integration tests with one command:

```bash
make test-integration
```

Run smoke tests with one command after `make dev` is healthy:

```bash
make smoke-test
```

### Deployment-oriented Docker builds

Production-style images can be built from the service Dockerfiles:

```bash
make docker-build
```

The backend image includes compiled binaries for every service plus the migration binary. Override the backend container entrypoint or command to run the desired binary, for example `/usr/local/bin/auth-service`, `/usr/local/bin/worker-service`, or `/usr/local/bin/migrate up`. The frontend image serves the Vite production build through nginx.
