# API Contract

## Overview

The React frontend communicates with the Go backend through the API Gateway. Internal microservices should not be called directly from the browser.

All endpoints return a standard response wrapper.

## Standard Success Response

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

## Standard Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "BOT_ACCESS_DENIED",
    "message": "The Gitea bot does not have access to this repository."
  }
}
```

## Auth APIs

### POST `/auth/login`

Logs in a user.

Request:

```json
{
  "credential": "student@example.com or student-user",
  "password": "password"
}
```

Response data:

```json
{
  "access_token": "jwt-or-session-token",
  "user": {
    "id": "user-id",
    "email": "student@example.com",
    "name": "Student Name",
    "full_name": "Student Name"
  }
}
```

Login accepts either a Tomorrow School email or username as the `credential` field.

### POST `/auth/logout`

Logs out the current user.

Response data:

```json
{
  "logged_out": true
}
```

### GET `/auth/me`

Returns the current authenticated user.

Response data:

```json
{
  "id": "user-id",
  "email": "student@example.com",
  "name": "Student Name",
  "full_name": "Student Name"
}
```

## Repository APIs

### POST `/repositories`

Creates a repository record from a Gitea URL. This does not read code yet.

Request:

```json
{
  "gitea_repo_url": "https://gitea.com/group/project"
}
```

Response data:

```json
{
  "id": "repository-id",
  "gitea_repo_url": "https://gitea.com/group/project",
  "bot_access_status": "unknown"
}
```

### POST `/repositories/:id/check-bot-access`

Called after the user clicks **"I already added the bot"**. The backend checks whether the server Gitea userbot can access the repository.

Response data:

```json
{
  "repository_id": "repository-id",
  "bot_access_status": "granted"
}
```

Possible error code:

```txt
BOT_ACCESS_DENIED
```

### POST `/repositories/:id/start-analysis`

Starts repository reading and AI analysis after bot access has been confirmed.

Response data:

```json
{
  "analysis_job_id": "analysis-job-id",
  "status": "pending"
}
```

### GET `/repositories/:id`

Returns repository status.

Response data:

```json
{
  "id": "repository-id",
  "gitea_repo_url": "https://gitea.com/group/project",
  "bot_access_status": "granted",
  "latest_analysis_job_id": "analysis-job-id"
}
```

## Analysis APIs

### GET `/analysis-jobs/:id`

Returns analysis job status.

Response data:

```json
{
  "id": "analysis-job-id",
  "repository_id": "repository-id",
  "status": "generating_questions",
  "error_message": null
}
```

Valid statuses:

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

### GET `/analysis-jobs/:id/questions`

Returns generated questions after the analysis job is completed. This endpoint is for preparing an exam, not for exposing answers to exam takers.

Response data:

```json
{
  "analysis_job_id": "analysis-job-id",
  "questions_count": 20,
  "questions": [
    {
      "id": "question-id",
      "question": "How does this program register HTTP routes?",
      "options": {
        "A": "From file names",
        "B": "Using route registration code",
        "C": "From the database",
        "D": "From the frontend"
      },
      "difficulty": "medium",
      "source_file_path": "internal/server/router.go"
    }
  ]
}
```

## Exam APIs

### POST `/exams`

Creates an exam from a completed analysis job.

Request:

```json
{
  "analysis_job_id": "analysis-job-id"
}
```

Response data:

```json
{
  "id": "exam-id",
  "analysis_job_id": "analysis-job-id",
  "status": "scheduled",
  "question_count": 20
}
```

### GET `/exams/:id`

Returns exam-safe data. Correct answers and explanations must not be included.

Response data:

```json
{
  "id": "exam-id",
  "status": "in_progress",
  "questions": [
    {
      "id": "question-id",
      "question": "What happens when this endpoint is called?",
      "options": {
        "A": "It reads request data and calls a service",
        "B": "It directly edits frontend state",
        "C": "It creates a Gitea token for the user",
        "D": "It skips backend validation"
      },
      "source_file_path": "internal/http/handler.go"
    }
  ]
}
```

### POST `/exams/:id/submit`

Submits selected answers for grading.

Request:

```json
{
  "answers": [
    {
      "question_id": "question-id",
      "selected_option": "A"
    }
  ]
}
```

Response data:

```json
{
  "exam_id": "exam-id",
  "submitted": true
}
```

### GET `/exams/:id/result`

Returns backend-graded result.

Response data:

```json
{
  "exam_id": "exam-id",
  "score": 16,
  "total_questions": 20,
  "passed": true
}
```
