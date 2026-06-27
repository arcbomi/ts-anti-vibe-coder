You are a senior Node.js TypeScript backend engineer.

Your task is to fully rewrite and clean:

backend/nodejs/packages/microservice-sdk

into a small, stable, reusable technical SDK for all backend microservices.

Breaking changes are allowed.

No backward compatibility is required.

You may delete old SDK exports, old SDK folders, old helper styles, and old internal architecture if they do not fit the new SDK design.

But after rewriting the SDK, all affected services that depend on it must be updated to compile.

The goal is:

microservice-sdk = reusable technical tools only
services = business usecases only

The SDK must NOT own business usecases.

The SDK must NOT register service-specific routes.

The SDK must NOT contain auth-service business logic.

The SDK must provide clean technical building blocks for services such as:

* config/env loading
* Fastify helpers
* response helpers
* error classes
* error handler
* request auth helpers
* JWT token service
* bearer auth preHandler
* Kafka/eventBus abstraction
* HTTP service client helpers
* user-service client
* Tomorrow School auth client
* logger
* shared technical contracts

Important:

Do not preserve old SDK API names if they are bad.

Do not create compatibility wrappers.

Do not keep deprecated exports.

Do not keep duplicate helpers that do the same thing.

Do not keep multiple competing patterns.

Create one clean SDK API and update service imports to use it.

---

Current SDK path:

backend/nodejs/packages/microservice-sdk

Main service that must work with the new SDK:

backend/nodejs/services/auth-service

The auth-service architecture should remain usecase-module based:

src/domains/auth/loginUser/
src/domains/auth/logoutUser/
src/domains/auth/readCurrentUser/

The SDK must support this auth-service style.

---

High-level architecture rule:

SDK owns reusable technical infrastructure.

Services own business usecases.

Example:

SDK may provide:

createEventBus()
createTokenService()
createUserServiceClient()
createTomorrowSchoolAuthClient()
sendSuccess()
errorHandler()
bearerAuth()
getCurrentUserId()
loadConfig()

SDK must NOT provide:

loginUser()
logoutUser()
readCurrentUser()
registerAuthRoutes()
AuthController
authRoutes
auth business policies
auth usecase registration

---

Before changing code:

1. Inspect the current SDK.
2. Inspect current SDK exports.
3. Inspect current auth-service imports.
4. Inspect package.json and tsconfig style.
5. Decide one clean SDK public API.
6. Remove old duplicated / bad SDK structure.
7. Rewrite SDK.
8. Update auth-service to use the new SDK API.
9. Run TypeScript check.
10. Run build if available.
11. Run tests if available.

Do not invent code blindly.

Use the existing repo’s TypeScript module style, import extension style, package manager, and tsconfig style.

Do not change the whole monorepo module system unless absolutely required.

---

Target SDK folder structure:

backend/nodejs/packages/microservice-sdk/
├── package.json
├── tsconfig.json
│
└── src/
├── index.ts
│
├── config/
│   ├── AppConfig.ts
│   ├── loadConfig.ts
│   └── index.ts
│
├── errors/
│   ├── AppError.ts
│   ├── BadRequestError.ts
│   ├── UnauthorizedError.ts
│   ├── ForbiddenError.ts
│   ├── NotFoundError.ts
│   ├── ConflictError.ts
│   └── index.ts
│
├── http/
│   ├── sendSuccess.ts
│   ├── sendError.ts
│   ├── errorHandler.ts
│   ├── createFastifyApp.ts
│   └── index.ts
│
├── auth/
│   ├── TokenService.ts
│   ├── createTokenService.ts
│   ├── bearerAuth.ts
│   ├── getCurrentUserId.ts
│   └── index.ts
│
├── eventBus/
│   ├── EventBus.ts
│   ├── createEventBus.ts
│   └── index.ts
│
├── clients/
│   ├── httpClient/
│   │   ├── HttpClient.ts
│   │   ├── createHttpClient.ts
│   │   └── index.ts
│   │
│   ├── userService/
│   │   ├── UserServiceClient.ts
│   │   ├── createUserServiceClient.ts
│   │   └── index.ts
│   │
│   └── tomorrowSchoolAuth/
│       ├── TomorrowSchoolAuthClient.ts
│       ├── createTomorrowSchoolAuthClient.ts
│       └── index.ts
│
├── logger/
│   ├── Logger.ts
│   ├── createLogger.ts
│   └── index.ts
│
└── testing/
├── createMockEventBus.ts
├── createMockTokenService.ts
└── index.ts

This is the target structure unless the existing repo strongly requires small adaptation.

Do not create random extra folders.

Do not create business-specific folders inside SDK.

Do not create service-specific folders inside SDK.

---

Public import rule:

Services should import SDK tools only from:

@backend/microservice-sdk

Allowed:

import {
loadConfig,
createEventBus,
createTokenService,
createUserServiceClient,
} from "@backend/microservice-sdk";

Not allowed:

import { createEventBus } from "@backend/microservice-sdk/src/eventBus/createEventBus";
import { createEventBus } from "@backend/microservice-sdk/dist/eventBus";
import { something } from "@backend/microservice-sdk/internal";

SDK internal file structure must be hidden from services.

src/index.ts must be the public SDK API.

---

Root src/index.ts must export only stable public SDK tools.

Suggested exports:

export * from "./config";
export * from "./errors";
export * from "./http";
export * from "./auth";
export * from "./eventBus";
export * from "./clients/httpClient";
export * from "./clients/userService";
export * from "./clients/tomorrowSchoolAuth";
export * from "./logger";
export * from "./testing";

Do not export private implementation details.

Do not export raw Kafka clients.

Do not export raw JWT library internals.

Do not export raw HTTP implementation internals.

---

Config module

Create:

src/config/AppConfig.ts
src/config/loadConfig.ts
src/config/index.ts

The SDK should expose one config loader:

loadConfig(serviceName: string): AppConfig

AppConfig should contain common backend config fields.

Suggested shape:

export type AppConfig = {
serviceName: string;
appEnv: string;
port: number;

jwtSecret: string;
jwtAccessTokenTtl?: string;

kafkaBrokers: string[];

userServiceBaseUrl?: string;
tomorrowSchoolBaseUrl?: string;

logLevel?: string;
};

loadConfig should:

* read process.env
* normalize env names
* validate required values
* return typed config
* throw SDK AppError or clear startup error if required config is missing

Do not make every service write its own config parser.

Do not put service business config here unless generally reusable.

Do not hardcode auth-service-specific logic.

---

Errors module

Create reusable error classes:

AppError
BadRequestError
UnauthorizedError
ForbiddenError
NotFoundError
ConflictError

AppError should include:

* code
* message
* statusCode
* details optional

Suggested shape:

export class AppError extends Error {
code: string;
statusCode: number;
details?: unknown;
}

Example error codes:

BAD_REQUEST
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INTERNAL_ERROR

Use these errors across SDK helpers and service route/usecase code.

Do not use plain Error for client-facing errors when SDK errors exist.

Do not leak sensitive external service error messages to clients.

---

HTTP module

Create:

sendSuccess.ts
sendError.ts
errorHandler.ts
createFastifyApp.ts

sendSuccess should produce consistent success responses.

Suggested response shape:

{
success: true,
data: ...
}

sendError / errorHandler should produce consistent error responses.

Suggested error shape:

{
success: false,
error: {
code: string,
message: string,
details?: unknown
}
}

errorHandler must:

* recognize AppError
* map AppError statusCode to HTTP status
* map unknown errors to 500
* avoid leaking internal error details in production
* allow useful details in development if existing repo style supports it

createFastifyApp may:

* create a Fastify instance
* register SDK error handler
* optionally register logger config
* return app

Do not register service-specific routes inside SDK.

Do not create auth routes inside SDK.

---

Auth module

Create:

TokenService.ts
createTokenService.ts
bearerAuth.ts
getCurrentUserId.ts

The SDK should expose a token service:

export type TokenService = {
signAccessToken(input: { userId: string }): Promise<string>;
verifyAccessToken(token: string): Promise<{ userId: string }>;
};

createTokenService(config: AppConfig): TokenService

Rules:

* Access token payload should be minimal.
* Use userId only unless current repo contract requires more.
* Do not put full user profile into JWT.
* Do not put password or external credentials into JWT.
* Hide JWT library details from services.

bearerAuth should be a Fastify preHandler compatible helper.

Responsibilities:

* read Authorization header
* require Bearer token
* verify token using TokenService or configured SDK token verifier
* attach authenticated user context to request in a safe way

getCurrentUserId(request) should:

* read authenticated user id from SDK auth context
* throw UnauthorizedError if missing
* not read from request body/query/params

Do not require services to parse Authorization manually.

Do not create local bearerAuth inside services.

Do not create global service-side Fastify type folders if avoidable.

If Fastify request typing is needed, keep typing inside SDK.

---

EventBus module

Create:

EventBus.ts
createEventBus.ts

Expose one abstraction:

export type EventBus = {
publish(event: {
topic: string;
key: string;
value: unknown;
}): Promise<void>;
};

createEventBus(config: AppConfig): EventBus

Rules:

* SDK may use Kafka/Redpanda internally.
* Services must not import kafkajs.
* Services must not create Kafka producers.
* Services publish events only through EventBus.
* EventBus must hide Kafka implementation details.
* EventBus should handle serialization consistently.
* EventBus should support clean shutdown if current app lifecycle needs it.

Do not expose raw Kafka producer to services.

Do not create event classes in services.

Do not create service-specific event folders in SDK.

The auth-service should publish these topics through SDK EventBus:

auth.user.logged_in
auth.user.logged_out

---

HTTP Client module

Create generic HTTP client helper:

src/clients/httpClient/

Expose:

HttpClient
createHttpClient

Suggested shape:

export type HttpClient = {
get<T>(path: string, options?: HttpRequestOptions): Promise<T>;
post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
put<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T>;
delete<T>(path: string, options?: HttpRequestOptions): Promise<T>;
};

createHttpClient(input: {
baseUrl: string;
headers?: Record<string, string>;
timeoutMs?: number;
}): HttpClient

Rules:

* hide fetch/axios/undici implementation
* normalize JSON responses
* map HTTP errors to SDK AppError types where reasonable
* do not leak raw low-level errors to services
* do not make services repeat base URL logic

---

User Service Client module

Create:

UserServiceClient.ts
createUserServiceClient.ts

Expose:

export type UserServiceClient = {
findOrCreateFromExternalUser(input: {
provider: "tomorrow_school";
externalId: string;
login: string;
email?: string;
displayName?: string;
avatarUrl?: string;
}): Promise<{
id: string;
login?: string;
email?: string;
displayName?: string;
avatarUrl?: string;
}>;

getCurrentUser(input: {
userId: string;
}): Promise<{
id: string;
login?: string;
email?: string;
displayName?: string;
avatarUrl?: string;
}>;
};

createUserServiceClient(config: AppConfig): UserServiceClient

Rules:

* user-service owns user profile
* auth-service must not modify user profile directly
* auth-service passes external identity to user-service client
* user-service client hides HTTP details
* SDK should not contain user business rules
* SDK client only calls user-service API

Do not create local user-service clients in auth-service.

---

Tomorrow School Auth Client module

Create:

TomorrowSchoolAuthClient.ts
createTomorrowSchoolAuthClient.ts

Expose:

export type TomorrowSchoolAuthClient = {
login(input: {
login: string;
password: string;
}): Promise<{
externalId: string;
login: string;
email?: string;
displayName?: string;
avatarUrl?: string;
}>;
};

createTomorrowSchoolAuthClient(config: AppConfig): TomorrowSchoolAuthClient

Rules:

* hide external HTTP/auth implementation details
* normalize external user identity
* map invalid credentials to UnauthorizedError
* do not leak raw Tomorrow School error messages
* never log password
* never return password
* never publish password
* never store password

Do not put loginUser usecase in SDK.

SDK client only authenticates against external provider and returns normalized identity.

---

Logger module

Create:

Logger.ts
createLogger.ts

Expose a small logger interface:

export type Logger = {
info(message: string, meta?: unknown): void;
warn(message: string, meta?: unknown): void;
error(message: string, meta?: unknown): void;
debug(message: string, meta?: unknown): void;
};

createLogger(config: AppConfig): Logger

Rules:

* no password logging
* no token logging
* no raw Authorization header logging
* no sensitive credential logging
* keep logger simple

---

Testing helpers

Create optional SDK test helpers:

createMockEventBus
createMockTokenService

These helpers can be used by services in unit tests.

Do not make tests require real Kafka.

Do not make tests require real JWT secrets unless testing TokenService itself.

---

Auth-service migration requirement

After rewriting SDK, update:

backend/nodejs/services/auth-service

to use only public SDK imports.

auth-service must not import SDK internal paths.

auth-service must not create local replacements for SDK tools.

auth-service should use SDK dependencies in app.ts:

loadConfig
createFastifyApp or Fastify + errorHandler
createTomorrowSchoolAuthClient
createUserServiceClient
createTokenService
createEventBus
sendSuccess
bearerAuth
getCurrentUserId

Adapt exact names to the new SDK exports you create.

The auth-service should stay usecase-module based.

Do not recreate:

src/config/
src/infrastructure/
src/shared/
src/clients/
src/controllers/
src/routes/
src/validation/
src/middlewares/
src/services/
src/repositories/
src/event/
src/interface/
src/types/

Inside auth-service, only keep:

src/app.ts
src/server.ts
src/index.ts
src/domains/auth/**

Tests may be colocated beside usecases as *.test.ts files.

---

Auth-service usecase dependency style

Use dependency injection.

Good:

const loginUser = createLoginUser({
tomorrowSchoolAuth,
userService,
tokenService,
eventBus,
});

Bad:

import { eventBus } from "@backend/microservice-sdk";

Usecases should receive dependencies.

Route files may receive SDK helpers through dependencies.

Usecase files must not import Fastify request/reply.

Route files may use Fastify.

---

Security rules

Never log passwords.

Never log access tokens.

Never log Authorization header.

Never include password in:

* response
* event payload
* error message
* logger metadata
* test snapshot

Tomorrow School invalid login should become UnauthorizedError or equivalent 401 response.

Invalid request body should become BadRequestError or equivalent 400 response.

readCurrentUser and logoutUser must get userId only from SDK auth context.

Do not read userId from body/query/params.

---

No backward compatibility rule

Breaking changes are allowed.

Delete old SDK exports that do not fit.

Delete duplicate helpers.

Delete deprecated patterns.

Delete old aliases.

Do not create compatibility wrappers.

Do not keep two ways to do the same thing.

But after breaking changes, update current dependent services so TypeScript check passes.

---

Do not over-engineer

Do not add:

* ports/
* adapters/
* application/
* domain/
* infrastructure/
* clean architecture ceremony
* repository interfaces
* service-specific SDK modules
* auth usecases in SDK
* route registration in SDK
* database layer in SDK unless already required by shared technical usage
* session table
* refresh token logic
* token blacklist
* local Kafka producer in services
* local JWT implementation in services

The SDK should be small and boring.

The service code should be business-focused.

---

Required SDK tests

Add or update unit tests for:

Config:

* loadConfig reads required env
* loadConfig throws on missing required env

Errors/HTTP:

* BadRequestError maps to 400
* UnauthorizedError maps to 401
* errorHandler maps unknown error to 500
* sendSuccess returns consistent success shape

Auth:

* TokenService signs and verifies access token
* bearerAuth rejects missing token
* bearerAuth rejects invalid token
* getCurrentUserId returns authenticated user id
* getCurrentUserId throws if missing

EventBus:

* createEventBus exposes publish
* publish serializes event value consistently
* do not require real Kafka in unit tests unless integration test already exists

Clients:

* userService client calls expected endpoints or current repo contract
* Tomorrow School auth client maps invalid credentials to UnauthorizedError
* clients do not leak raw low-level errors

Auth-service usecase tests:

* loginUser validates input
* loginUser calls Tomorrow School auth client
* loginUser calls userService.findOrCreateFromExternalUser
* loginUser signs token
* loginUser publishes auth.user.logged_in
* loginUser returns accessToken and user
* logoutUser publishes auth.user.logged_out
* logoutUser returns success
* readCurrentUser calls userService.getCurrentUser
* readCurrentUser returns user

Do not require real Kafka in unit tests.

Do not require real Tomorrow School login in unit tests.

---

Required final output

After rewriting, output:

1. Final SDK folder tree
2. Final auth-service folder tree
3. SDK files created
4. SDK files deleted
5. SDK files kept
6. SDK public exports
7. SDK internal exports not exposed publicly
8. Services updated to new SDK API
9. Old SDK APIs removed
10. Old SDK folders removed
11. Auth-service files updated
12. Kafka/eventBus implementation summary
13. JWT/token implementation summary
14. HTTP error response shape
15. Success response shape
16. Security decisions
17. Tests added
18. TypeScript check result
19. Build result
20. Test result
21. Assumptions made
22. Any remaining missing environment variables or external service contracts

Expected final architecture sentence:

microservice-sdk provides config, HTTP helpers, errors, JWT token service, bearer auth, Kafka eventBus, service clients, logger, and common technical tools.
Business services own their own usecases and route registration.
The SDK does not own business usecases or service-specific routes.

Use Redpanda as the default Kafka-compatible broker for local development and Docker Compose.

However, do not expose Redpanda-specific APIs to business services.

The SDK should expose only:

createEventBus(config)

and:

eventBus.publish({
  topic: string;
  key: string;
  value: unknown;
})

Internally, createEventBus may use kafkajs or another Kafka-compatible client to connect to Redpanda.

Services must not import kafkajs.
Services must not import Redpanda clients.
Services must not create producers.
Services must not know whether the broker is Redpanda or Apache Kafka.

Config should use generic names:

KAFKA_BROKERS=redpanda:9092

not:

REDPANDA_BROKERS

Reason:

Redpanda is Kafka API-compatible, and using generic Kafka config keeps the SDK replaceable later.

Docker Compose may run a service named redpanda, but SDK public API should still be eventBus, not redpandaBus.