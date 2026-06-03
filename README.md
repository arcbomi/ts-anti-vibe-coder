
# Codebase Understanding Exam Platform

One-sentence description:

> A GitLab-based codebase understanding exam platform where users add a server GitLab bot as a repository collaborator, the system automatically analyzes the code with AI, generates 20 English-only functional code questions, and verifies offline whether the user truly understands the project.

## Core Flow

1. User logs in.
2. User enters a GitLab repository URL.
3. Platform instructs the user to add our GitLab server bot as a collaborator.
4. User clicks: “I already added the bot.”
5. Backend checks bot access (user does **not** provide a personal GitLab token).
6. If access is valid, backend reads the repository and runs async AI analysis via a queue.
7. AI generates 20 **English-only** multiple-choice questions (A/B/C/D).
8. User goes to an offline exam (Friday) and answers questions.
9. Backend grades and decides pass/fail (backend is the source of truth).

## Important Product Rules

1. User does not upload code manually.
2. User does not provide GitLab personal token.
3. User adds server GitLab bot to repo collaboration.
4. User must click “I already added the bot.”
5. System checks bot access before reading.
6. AI questions are English only.
7. No admin question review.
8. Questions must test actual program understanding.
9. Backend grading is the source of truth.
10. Frontend must not know correct answers during exam.

## Monorepo Layout

- `backend/`: Go microservices + shared SDK
- `frontend/`: React + Vite + TypeScript (domain-separated)

## Backend Architecture (Go Microservices)

Backend is built as multiple independently runnable programs:

```
backend/
	cmd/
		api-gateway/
		auth-service/
		gitlab-reader-service/
		ai-analysis-service/
		question-service/
		exam-service/
		scheduler-service/
		worker-service/

	internal/
		auth/
		gitlab/
		analysis/
		question/
		exam/
		scheduler/
		worker/

	pkg/
		sdk/
			config/
			logger/
			errors/
			httpclient/
			middleware/
			queue/
			database/
			gitlabclient/
			aiclient/
			examclient/
			questionclient/
```

### Centralized SDK Requirement

All microservices share one centralized SDK under `backend/pkg/sdk/`.

- Shared logic only
- No duplicated cross-cutting code inside services

### Auth Service (Future Requirement)

In the future, `auth-service` should support Tomorrow School's own account system.
The platform should be able to authenticate users with Tomorrow School internal accounts.

## Frontend Architecture (React + Vite + TypeScript)

Frontend is domain-separated. Each domain owns its own `api/`, `hooks/`, `store/`, `components/`, `pageSection/`, `types/`, and `README.md`.

Pages under `frontend/src/pages/` only compose page sections; they should not contain heavy business logic.

## Local Development (MVP)

### 1) Start Infra

This repo uses Postgres + Redis for local development.

```bash
docker compose up -d
```

### 2) Backend

```bash
cd backend
go test ./...
```

Start services (ports are configured by env vars):

```bash
go run ./cmd/auth-service
go run ./cmd/api-gateway
go run ./cmd/worker-service
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuration

Copy `.env.example` and fill values for local runs.
