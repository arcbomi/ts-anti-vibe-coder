# Auth Service

This service handles authentication for the Gitea Codebase Understanding Exam Platform.

## Current features

- User registration
- User login through Tomorrow School signin
- User logout
- Current user session
- Internal JWT issuance after successful external authentication
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
- `TOMORROW_SCHOOL_AUTH_ENDPOINT=https://01.tomorrow-school.ai/api/auth/signin`

Optional Tomorrow School signin configuration:

- `TOMORROW_SCHOOL_AUTH_TIMEOUT_SECONDS=10`
- `TOMORROW_SCHOOL_AUTH_REFERRER=https://01.tomorrow-school.ai/?show-password=1`
- `TOMORROW_SCHOOL_AUTH_X_JWT_TOKEN=undefined`
- `TOMORROW_SCHOOL_AUTH_SESSION_ID=`
- `JWT_REFRESH_TOKEN_TTL_DAYS=30`

Development-only local seed user:

- `DEV_SEED_USER_NAME=Student User`
- `DEV_SEED_USER_EMAIL=student@example.com`
- `DEV_SEED_USER_PASSWORD=correct-password`

## Authentication flow

`POST /auth/login` now forwards an email-or-username credential plus password to Tomorrow School's signin endpoint using HTTP Basic authentication. A successful Tomorrow School JWT is treated only as proof of login. This service still issues its own JWT for internal services, and downstream services continue validating only locally issued JWTs.

Tomorrow School JWTs are not locally validated because their signing secret/public key is not available to this service.

## This service should not handle

- Gitea repository reading
- AI analysis
- Question generation
- Exam grading

The user does not need to provide a Gitea personal token. Repository access is handled by the Gitea server userbot flow in another service.

## Integration notes

Other services and the API Gateway can depend on this service to identify the current user. The Auth Service exposes only:

- `user_id`
- `email`
- `name`
- `full_name`

It never exposes password hashes or private token data. The authenticated user ID will be used by the Gitea Reader Service, AI Analysis Service, Question Service, and Exam Service.
