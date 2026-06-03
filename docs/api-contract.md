# API Contract

## Overview

This document defines the public API contract between the React/Vite/TypeScript frontend and the Go backend microservices for the GitLab Codebase Understanding Exam Platform.

The frontend must call only the public API gateway. Internal services such as `auth-service`, `gitlab-reader-service`, `ai-analysis-service`, `question-service`, `exam-service`, and `worker-service` must not expose direct browser-facing endpoints.

Core product rules enforced by this contract:

- Users do not provide GitLab personal access tokens.
- Users do not upload repository code manually.
- Users grant access by adding the platform GitLab server userbot as a repository collaborator.
- The backend verifies bot access before reading repository code.
- AI generates exactly 20 English-only A/B/C/D questions.
- AI-generated questions are used directly; there is no admin question review step.
- Frontend exam pages receive only exam-safe questions and never receive correct answers or explanations.
- Backend grading is the source of truth for score and pass/fail status.

All timestamps are ISO 8601 strings in UTC, for example `2026-06-03T12:00:00Z`.
All identifiers are UUID strings unless stated otherwise.

## Base URL

Frontend requests should be sent to the API gateway base URL.

```txt
Development: http://localhost:8080
Production:  configured by VITE_API_BASE_URL
```

Frontend code should call relative API paths through the shared client, for example:

```ts
post<Repository>("/repositories", payload)
```

The shared client resolves that path against `VITE_API_BASE_URL`.

## Authentication

The MVP uses email/password login and bearer tokens.

Authenticated requests must include:

```txt
Authorization: Bearer <access_token>
```

The frontend stores the access token using the agreed frontend auth storage strategy and the shared API client attaches it automatically when available.

Future authentication options to support later:

- Tomorrow School account login
- Tomorrow School SSO

### Auth Types

```ts
type UserRole = "student" | "staff";

interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  user: AuthUser;
}
```

## Standard Response Format

Every public API endpoint must return the same wrapper shape.

### Success

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

TypeScript shape:

```ts
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
}
```

## Error Format

### Error

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "BOT_ACCESS_DENIED",
    "message": "The GitLab bot does not have access to this repository."
  }
}
```

TypeScript shape:

```ts
interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

Validation errors may include field-level details:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {
      "gitlab_repo_url": "Must be a valid GitLab repository URL."
    }
  }
}
```

## Error Codes

| Code | Meaning |
| --- | --- |
| `UNAUTHORIZED` | Missing, expired, or invalid authentication token. |
| `FORBIDDEN` | Authenticated user does not have permission for the resource. |
| `VALIDATION_ERROR` | Request body, path parameter, or query parameter is invalid. |
| `REPOSITORY_NOT_FOUND` | Repository record does not exist or is not owned by the user. |
| `INVALID_REPOSITORY_URL` | Submitted URL is not a valid GitLab repository URL. |
| `BOT_ACCESS_DENIED` | GitLab bot cannot access the repository. |
| `BOT_ACCESS_CHECK_FAILED` | Backend could not complete the bot access check due to GitLab/API/network failure. |
| `ANALYSIS_JOB_NOT_FOUND` | Analysis job does not exist or is not visible to the user. |
| `ANALYSIS_NOT_COMPLETED` | Questions or exam creation requested before analysis completed. |
| `QUESTION_NOT_FOUND` | Question does not exist or is not visible to the user. |
| `EXAM_NOT_FOUND` | Exam does not exist or is not owned by the user. |
| `EXAM_ALREADY_SUBMITTED` | Exam submission was already completed. |
| `INVALID_EXAM_ANSWER` | Submitted answer payload is malformed or contains non-A/B/C/D values. |
| `INTERNAL_ERROR` | Unexpected server-side error. |

## Auth APIs

### POST `/auth/login`

Authenticates a user with MVP email/password credentials.

Request:

```ts
interface LoginRequest {
  email: string;
  password: string;
}
```

Example request:

```json
{
  "email": "student@example.com",
  "password": "correct-horse-battery-staple"
}
```

Response data:

```ts
interface LoginResponse {
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  user: AuthUser;
}
```

### POST `/auth/logout`

Invalidates the current access token or session.

Headers:

```txt
Authorization: Bearer <access_token>
```

Request body: none.

Response data:

```ts
interface LogoutResponse {
  logged_out: true;
}
```

### GET `/auth/me`

Returns the authenticated user.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: "student" | "staff";
  created_at: string;
}
```

## Repository APIs

### Repository Types

```ts
type BotAccessStatus = "unknown" | "checking" | "granted" | "denied";

interface Repository {
  id: string;
  gitlab_repo_url: string;
  bot_access_status: BotAccessStatus;
  created_at: string;
}

interface CreateRepositoryRequest {
  gitlab_repo_url: string;
}

interface StartAnalysisResponse {
  analysis_job_id: string;
  repository_id: string;
  status: AnalysisJobStatus;
}
```

### POST `/repositories`

Creates a repository record after the user enters a GitLab repository URL. This endpoint must not read repository code. It only stores the repository record and lets the frontend show bot collaborator instructions.

Headers:

```txt
Authorization: Bearer <access_token>
```

Request:

```json
{
  "gitlab_repo_url": "https://gitlab.com/group/project"
}
```

Response data:

```ts
Repository
```

Expected initial `bot_access_status` is `unknown`.

### GET `/repositories/:id`

Returns a repository record owned by the authenticated user.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
Repository
```

### POST `/repositories/:id/check-bot-access`

Checks whether the platform GitLab userbot has access after the user clicks **"I already added the bot."**

Headers:

```txt
Authorization: Bearer <access_token>
```

Request body: none.

Response data:

```ts
Repository
```

If access is granted, `bot_access_status` must be `granted`.
If access is denied, return an error with `BOT_ACCESS_DENIED` or return a repository with `bot_access_status: "denied"`; the preferred MVP behavior is the error response so the frontend can show a clear failure message.

### POST `/repositories/:id/start-analysis`

Starts the backend repository reading and AI analysis process. Backend must reject this request unless bot access is already `granted`.

Headers:

```txt
Authorization: Bearer <access_token>
```

Request body: none.

Response data:

```ts
interface StartAnalysisResponse {
  analysis_job_id: string;
  repository_id: string;
  status: AnalysisJobStatus;
}
```

## Analysis Job APIs

### Analysis Job Types

```ts
type AnalysisJobStatus =
  | "pending"
  | "checking_bot_access"
  | "reading_repository"
  | "indexing_code"
  | "analyzing_code"
  | "generating_questions"
  | "saving_questions"
  | "completed"
  | "failed";

interface AnalysisJob {
  id: string;
  repository_id: string;
  status: AnalysisJobStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
```

### GET `/analysis-jobs/:id`

Returns the current analysis job status. The frontend can poll this endpoint while analysis is running.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
AnalysisJob
```

### GET `/analysis-jobs/:id/questions`

Returns generated questions for a completed analysis job outside active exam mode. This endpoint is intended for post-analysis repository question listing/debug display only if enabled by product policy. It must return `ANALYSIS_NOT_COMPLETED` unless the analysis job status is `completed`.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
interface AnalysisQuestionsResponse {
  analysis_job_id: string;
  questions: InternalQuestion[];
  total_questions: 20;
}
```

Important: exam-taking screens must not use this endpoint. Exam-taking screens must use `GET /exams/:id/questions`, which returns `ExamQuestion[]` without `correct_option` and without `explanation`.

## Question Models

Questions are generated directly by AI with no admin review step.

Generation constraints:

- Exactly 20 questions per completed analysis job.
- English-only question text, options, and explanations.
- A/B/C/D options only.
- Each question must have exactly four options.

### InternalQuestion

`InternalQuestion` may contain the correct answer and explanation. It must never be returned by active exam endpoints.

```ts
type QuestionOption = "A" | "B" | "C" | "D";
type QuestionDifficulty = "easy" | "medium" | "hard";

interface InternalQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: QuestionOption;
  explanation: string;
  difficulty: QuestionDifficulty;
  source_file_path: string | null;
}
```

### ExamQuestion

`ExamQuestion` is safe for exam mode. It must not contain `correct_option` or `explanation`.

```ts
interface ExamQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  difficulty: QuestionDifficulty;
  source_file_path: string | null;
}
```

## Exam APIs

### Exam Types

```ts
type ExamStatus = "scheduled" | "in_progress" | "submitted" | "graded";
type QuestionOption = "A" | "B" | "C" | "D";

interface Exam {
  id: string;
  repository_id: string;
  analysis_job_id: string;
  status: ExamStatus;
  scheduled_for: string;
  question_count: 20;
  created_at: string;
  submitted_at: string | null;
}

interface CreateExamRequest {
  repository_id: string;
  analysis_job_id: string;
}

interface ExamQuestionsResponse {
  exam_id: string;
  questions: ExamQuestion[];
  total_questions: 20;
}

interface ExamAnswer {
  question_id: string;
  selected_option: QuestionOption;
}

interface SubmitExamRequest {
  answers: ExamAnswer[];
}

interface ExamResult {
  exam_id: string;
  score: number;
  total_questions: number;
  correct_count: number;
  passed: boolean;
  passing_score: number;
  submitted_at: string;
}
```

Exam rules:

- Exams contain exactly 20 questions.
- Answers must be A/B/C/D only.
- Question content must be English only.
- Offline exams are held every Friday.
- Passing score is configurable; default is 70%.
- The frontend must not calculate score or pass/fail itself.
- The frontend must display only the result returned by the backend.

### POST `/exams`

Creates or schedules an exam from a completed analysis job.

Headers:

```txt
Authorization: Bearer <access_token>
```

Request:

```json
{
  "repository_id": "uuid",
  "analysis_job_id": "uuid"
}
```

Response data:

```ts
Exam
```

Backend must return `ANALYSIS_NOT_COMPLETED` if the analysis job is not completed or does not have exactly 20 generated questions.

### GET `/exams/:id`

Returns exam metadata for the authenticated user.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
Exam
```

### GET `/exams/:id/questions`

Returns exam-safe questions for active exam taking. This endpoint must never include `correct_option` or `explanation`.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
ExamQuestionsResponse
```

Example response data:

```json
{
  "exam_id": "uuid",
  "questions": [
    {
      "id": "uuid",
      "question": "Which file registers the main HTTP routes for this service?",
      "option_a": "cmd/api-gateway/main.go",
      "option_b": "README.md",
      "option_c": "go.sum",
      "option_d": "frontend/index.html",
      "difficulty": "medium",
      "source_file_path": "cmd/api-gateway/main.go"
    }
  ],
  "total_questions": 20
}
```

### POST `/exams/:id/submit`

Submits exam answers for backend grading.

Headers:

```txt
Authorization: Bearer <access_token>
```

Request:

```json
{
  "answers": [
    {
      "question_id": "uuid",
      "selected_option": "A"
    }
  ]
}
```

Validation rules:

- `answers` must contain one answer per exam question for normal final submission.
- `selected_option` must be one of `A`, `B`, `C`, or `D`.
- Unknown question IDs must return `INVALID_EXAM_ANSWER`.
- Re-submission must return `EXAM_ALREADY_SUBMITTED`.

Response data:

```ts
ExamResult
```

The backend grades the exam and returns score/result. The frontend must not calculate pass/fail.

### GET `/exams/:id/result`

Returns the backend-graded exam result.

Headers:

```txt
Authorization: Bearer <access_token>
```

Response data:

```ts
interface ExamResult {
  exam_id: string;
  score: number;
  total_questions: number;
  correct_count: number;
  passed: boolean;
  passing_score: number;
  submitted_at: string;
}
```

## TypeScript Shared API Client

The frontend shared API client lives at:

```txt
frontend/src/shared/api/client.ts
```

It exports:

```ts
API_BASE_URL
ApiResponse<T>
ApiError
request<T>()
get<T>()
post<T>()
put<T>()
del<T>()
```

Domain-specific API modules must stay in their domain folders and call this shared client instead of adding domain endpoints to the shared client.

Example domain API usage:

```ts
import { post } from "@/shared/api/client";

export function createRepository(payload: CreateRepositoryRequest) {
  return post<Repository>("/repositories", payload);
}
```

## Security Rules

- Frontend must never receive `correct_option` during active exam.
- Frontend must never receive `explanation` during active exam.
- Backend must grade exam answers.
- Backend must verify user ownership of repository and exam.
- Backend must verify bot access before reading repository.
- Backend should not expose raw repository source code to frontend.
- Backend should filter sensitive files before AI analysis.
- Frontend must not receive GitLab bot credentials.
- Backend must not accept user-provided GitLab personal access tokens for repository reading.
- Backend must reject analysis start requests when bot access is not `granted`.
- API gateway must enforce authentication and forward only authorized requests to internal microservices.

## Frontend Integration Notes

- Store domain API files under each domain's `api/` folder.
- Use `frontend/src/shared/api/client.ts` for fetch, JSON serialization, auth headers, response unwrapping, and API errors.
- Poll `GET /analysis-jobs/:id` until status is `completed` or `failed`.
- Only enable `POST /repositories/:id/start-analysis` after `check-bot-access` returns granted status.
- Exam-taking pages must call `GET /exams/:id/questions`, not `GET /analysis-jobs/:id/questions`.
- Exam result pages must display `score`, `correct_count`, `passed`, and `passing_score` exactly as returned by `GET /exams/:id/result` or `POST /exams/:id/submit`.
- Treat all failed API wrappers as exceptions in UI hooks and show `error.message` to the user.
