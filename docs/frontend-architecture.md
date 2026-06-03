# Frontend Architecture

## Stack

The frontend uses:

```txt
React + Vite + TypeScript
```

The frontend should be organized by product domain so the codebase remains easy to understand and extend.

## Domain-Separated Structure

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

Each domain must contain:

```txt
api/
hooks/
store/
components/
pageSection/
types/
README.md
```

## Folder Responsibilities

### `components/`

Small reusable UI components for a single domain.

Examples:

- `RepositoryUrlInput`
- `BotAccessStatusBadge`
- `QuestionOptionCard`
- `ExamTimer`

### `pageSection/`

Larger page layout sections built from domain components and hooks.

Examples:

- `RepositoryConnectionSection`
- `AnalysisProgressSection`
- `ExamQuestionSection`
- `ExamResultSection`

### `pages/`

Route-level composition only. Pages should import and arrange page sections, but they should not contain heavy business logic, API details, or complex state transitions.

Example:

```tsx
export function RepositoryPage() {
  return <RepositoryConnectionSection />;
}
```

## Domain Ownership Rules

- `auth` owns login, logout, current-user state, and future Tomorrow School login support.
- `repository` owns GitLab repository URL submission and bot access status UI.
- `analysis` owns analysis job progress and generated-question readiness state.
- `question` owns question display models and reusable question UI.
- `exam` owns exam creation, answer selection, submission, and result display.

Domains may use shared utilities, but one domain should not reach into another domain's internal store or implementation details. Cross-domain behavior should happen through page composition, typed APIs, or shared app-level orchestration.

## Shared Folder Usage

`src/shared/` is for code that is truly reusable across domains:

- API client wrapper.
- Common UI primitives.
- Formatting helpers.
- Shared TypeScript utility types.
- Error display helpers.

Do not put domain-specific business logic in `shared/`. If code belongs to only one domain, keep it inside that domain.
