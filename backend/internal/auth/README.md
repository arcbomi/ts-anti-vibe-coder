# Auth Service

This service handles authentication for the GitLab Codebase Understanding Exam Platform.

## Current features

- User registration
- User login
- User logout
- Current user session
- Password hashing with bcrypt
- Short-lived JWT access tokens
- Auth middleware for protected routes

## API endpoints

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

All responses use the shared SDK response envelope from `backend/pkg/sdk/errors`.

## Environment variables

Required:

- `AUTH_SERVICE_PORT=8081` or `AUTH_SERVICE_HTTP_PORT=8081`
- `DATABASE_URL=postgres://...`
- `JWT_SECRET=...`
- `JWT_ACCESS_TOKEN_TTL_MINUTES=60`

Optional future SSO configuration:

- `JWT_REFRESH_TOKEN_TTL_DAYS=30`
- `TOMORROW_SCHOOL_SSO_CLIENT_ID=`
- `TOMORROW_SCHOOL_SSO_CLIENT_SECRET=`
- `TOMORROW_SCHOOL_SSO_REDIRECT_URL=`

## Future plan

In the future, this auth service should support Tomorrow School own account system or Tomorrow School SSO, including:

- Support Tomorrow School own account login
- Support Tomorrow School internal SSO
- Support student identity verification

The current code keeps authentication concerns isolated so Tomorrow School identity providers can be added without mixing in repository reading, question generation, or exam grading logic.

## This service should not handle

- GitLab repository reading
- AI analysis
- Question generation
- Exam grading

The user does not need to provide a GitLab personal token. Repository access is handled by the GitLab server userbot flow in another service.

## Integration notes

Other services and the API Gateway can depend on this service to identify the current user. The Auth Service exposes only:

- `user_id`
- `email`
- `name`

It never exposes password hashes or private token data. The authenticated user ID will be used by the GitLab Reader Service, AI Analysis Service, Question Service, and Exam Service.
