# Deployment

## Required Services

The platform requires these backend services:

- API Gateway
- Auth Service
- GitLab Reader Service
- AI Analysis Service
- Question Service
- Exam Service
- Worker Service

It also requires:

- React frontend application.
- Database.
- Queue.
- GitLab server userbot account.
- AI API access.

## Environment Variables

Recommended environment variables:

```txt
APP_ENV=production
API_GATEWAY_PORT=8080
DATABASE_URL=postgres://user:password@host:5432/app
QUEUE_URL=redis://host:6379/0
GITLAB_BASE_URL=https://gitlab.com
GITLAB_BOT_USERNAME=platform-userbot
GITLAB_BOT_TOKEN=server-bot-token
AI_API_KEY=ai-provider-key
JWT_SECRET=change-me
FRONTEND_ORIGIN=https://app.example.com
VITE_API_BASE_URL=https://api.example.com
```

The exact names can be adjusted during implementation, but all services should load configuration through `backend/pkg/sdk/config`.

## Running Backend Services

Each service should be runnable as a Go program under `backend/cmd`.

Example local commands:

```bash
cd backend
go run ./cmd/api-gateway
go run ./cmd/auth-service
go run ./cmd/gitlab-reader-service
go run ./cmd/ai-analysis-service
go run ./cmd/question-service
go run ./cmd/exam-service
```

In production, run each service as a separate process, container, or deployment unit.

## Running Worker Service

The worker service processes queue jobs for repository reading, indexing, AI analysis, question generation, and question saving.

```bash
cd backend
go run ./cmd/worker-service
```

The worker must have access to the database, queue, GitLab bot credentials, and AI API key.

## Running Frontend

Local development:

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
cd frontend
npm install
npm run build
```

The frontend must be configured with `VITE_API_BASE_URL` so it can call the API Gateway.

## Queue Requirement

A queue is required for long-running repository and AI analysis jobs. Redis is acceptable for the MVP.

The queue should handle:

- Analysis job creation.
- Worker job consumption.
- Retry for transient failures.
- Failed-job tracking.

## Database Requirement

A database is required to store:

- Users.
- Repository records.
- Bot access status.
- Analysis jobs and job statuses.
- Generated questions.
- Exams.
- Submitted answers.
- Graded results.

PostgreSQL is recommended for the MVP.

## GitLab Bot Account Requirement

The platform needs a GitLab server userbot account. Users must add this bot account as a collaborator to repositories they want analyzed.

The backend uses the bot account credentials to:

- Check whether the bot can access a repository.
- Read repository code after access is confirmed.

The platform must not ask users for personal GitLab tokens.

## AI API Key Requirement

The AI Analysis Service and Worker Service need an AI API key to analyze code and generate questions.

The AI system must generate exactly 20 English-only A/B/C/D questions with one correct answer, an explanation, and a source file path for each question.
