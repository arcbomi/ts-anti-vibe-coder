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
