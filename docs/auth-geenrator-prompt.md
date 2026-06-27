You are a senior Node.js TypeScript backend engineer.

Your task is to rewrite and simplify:

```txt
backend/nodejs/services/auth-service
```

into a usecase-module architecture.

The goal is:

```txt
SDK = reusable technical tools
auth-service = auth business usecases + each usecase owns its own route registration
```

Important architecture rule:

The auth-service should NOT use a global `controllers/`, `routes/`, `validation/`, `middlewares/`, `interface/http/`, `event/`, `shared/`, `infrastructure/`, or `config/` structure.

Instead, every business usecase should be its own small module.

Each usecase module may contain:

```txt
<usecase>.ts
<usecase>.input.ts
<usecase>.output.ts
<usecase>.policy.ts
<usecase>.route.ts
index.ts
```

The `.route.ts` file registers only that usecase’s HTTP route.

Do NOT register all auth routes in one big `authRoutes.ts`.
Do NOT create `authController.ts`.
Do NOT create `interface/http/`.

Each route should live beside the usecase it belongs to.

---

# Current service path

```txt
backend/nodejs/services/auth-service
```

# Current problem

The current auth-service mixes too many styles:

```txt
src/config/
src/clients/
src/controllers/
src/routes/
src/validation/
src/middlewares/
src/models/
src/repositories/
src/services/
src/shared/
src/domain/
src/types/
```

This is messy.

Rewrite it so that the structure is small, usecase-based, and easy for coding agents to modify.

---

# SDK responsibility

The `@backend/microservice-sdk` should provide reusable technical tools such as:

```txt
- config/env loading
- Fastify app helpers if available
- sendSuccess / sendError helpers
- error handler
- request helpers
- JWT signing and verification
- bearer auth helper/middleware
- user-service client
- Tomorrow School auth client
- Kafka producer / comsumer (BTW DO NOT USE KAFKA,USE REDPANDA,KAFKA APACHE ALTERNATIVE)
- shared contracts
- shared errors
```

But important:

The SDK should NOT own auth route registration.

Route registration should be inside each auth usecase module:

```txt
loginUser/loginUser.route.ts
logoutUser/logoutUser.route.ts
readCurrentUser/readCurrentUser.route.ts
```

---

# Target folder structure

Rewrite auth-service into this structure:

```txt
backend/nodejs/services/auth-service/
├── package.json
├── tsconfig.json
│
└── src/
    ├── app.ts
    ├── server.ts
    ├── index.ts
    │
    └── domains/
        └── auth/
            ├── loginUser/
            │   ├── loginUser.ts
            │   ├── loginUser.input.ts
            │   ├── loginUser.output.ts
            │   ├── loginUser.policy.ts
            │   ├── loginUser.route.ts
            │   └── index.ts
            │
            ├── logoutUser/
            │   ├── logoutUser.ts
            │   ├── logoutUser.input.ts
            │   ├── logoutUser.output.ts
            │   ├── logoutUser.route.ts
            │   └── index.ts
            │
            ├── readCurrentUser/
            │   ├── readCurrentUser.ts
            │   ├── readCurrentUser.input.ts
            │   ├── readCurrentUser.output.ts
            │   ├── readCurrentUser.route.ts
            │   └── index.ts
            │
            ├── model/
            │   ├── AuthResponse.ts
            │   └── CurrentUser.ts
            │
            └── index.ts
```

Do NOT create these folders:

```txt
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
src/interface/http/
src/types/
```

Do NOT create these files:

```txt
authRoutes.ts
authController.ts
authValidation.ts
bearerAuth.ts
UserLoggedIn.ts
UserLoggedOut.ts
types/fastify.d.ts
```

If Fastify request typing is needed, use SDK-provided types or local inline type imports only. Do not create a global `types/` folder.

---

# Required usecases

Only implement these usecases:

```txt
loginUser
logoutUser
readCurrentUser
```

Do NOT add:

```txt
registerUser
refreshSession
resetPassword
changePassword
AuthUserRepository
PasswordPort
database
session table
local JWT implementation
local Kafka implementation
```

This auth-service uses Tomorrow School / external auth login. It does not own password storage or registration.

---

# Usecase module rules

Each usecase module has two parts:

```txt
1. business usecase file
2. route registration file
```

Example:

```txt
loginUser/loginUser.ts
= business flow

loginUser/loginUser.route.ts
= HTTP route adapter for POST /auth/login
```

The route file may touch Fastify request/reply.

The usecase file must NOT touch Fastify request/reply.

---

# loginUser module

Create:

```txt
src/domains/auth/loginUser/loginUser.ts
src/domains/auth/loginUser/loginUser.input.ts
src/domains/auth/loginUser/loginUser.output.ts
src/domains/auth/loginUser/loginUser.policy.ts
src/domains/auth/loginUser/loginUser.route.ts
src/domains/auth/loginUser/index.ts
```

## loginUser.input.ts

Use this shape unless existing contracts require a different name:

```ts
export type LoginUserInput = {
  login: string;
  password: string;
};
```

## loginUser.output.ts

```ts
import type { CurrentUser } from "../model/CurrentUser";

export type LoginUserOutput = {
  accessToken: string;
  user: CurrentUser;
};
```

## loginUser.policy.ts

Put business-specific login checks here.

Example:

```ts
import type { LoginUserInput } from "./loginUser.input";

export function assertLoginInputAllowed(input: LoginUserInput) {
  if (!input.login || !input.password) {
    throw new Error("Login and password are required");
  }
}
```

Do not put HTTP-only validation here.

HTTP shape validation can happen in `loginUser.route.ts`.

## loginUser.ts

Responsibilities:

```txt
- receive LoginUserInput
- check login policy
- call SDK Tomorrow School auth client
- receive external user identity
- call SDK user-service client to find or create local JWT for user
- call SDK token service to issue access token
- publish login event through SDK Kafka
- return LoginUserOutput
```

Use dependency injection.

Suggested shape:

```ts
import type { CurrentUser } from "../model/CurrentUser";
import type { LoginUserInput } from "./loginUser.input";
import type { LoginUserOutput } from "./loginUser.output";
import { assertLoginInputAllowed } from "./loginUser.policy";

export function createLoginUser(deps: {
  tomorrowSchoolAuth: {
    login(input: { login: string; password: string }): Promise<{
      externalId: string;
      login: string;
      email?: string;
      displayName?: string;
      avatarUrl?: string;
    }>;
  };

  userService: {
    findOrCreateFromExternalUser(input: {
      provider: "tomorrow_school";
      externalId: string;
      login: string;
      email?: string;
      displayName?: string;
      avatarUrl?: string;
    }): Promise<CurrentUser>;
  };

  tokenService: {
    signAccessToken(input: { userId: string }): Promise<string>;
  };

  eventBus: {
    publish(event: {
      topic: string;
      key: string;
      value: unknown;
    }): Promise<void>;
  };
}) {
  return async function loginUser(input: LoginUserInput): Promise<LoginUserOutput> {
    assertLoginInputAllowed(input);

    const externalUser = await deps.tomorrowSchoolAuth.login({
      login: input.login,
      password: input.password,
    });

    const user = await deps.userService.findOrCreateFromExternalUser({
      provider: "tomorrow_school",
      externalId: externalUser.externalId,
      login: externalUser.login,
      email: externalUser.email,
      displayName: externalUser.displayName,
      avatarUrl: externalUser.avatarUrl,
    });

    const accessToken = await deps.tokenService.signAccessToken({
      userId: user.id,
    });

    await deps.eventBus.publish({
      topic: "auth.user.logged_in",
      key: user.id,
      value: {
        userId: user.id,
        provider: "tomorrow_school",
        occurredAt: new Date().toISOString(),
      },
    });

    return {
      accessToken,
      user,
    };
  };
}
```

Adapt exact method names to actual SDK exports.

Do not import `kafkajs`.
Do not create local Kafka producer.
Do not create local event class.
Do not create local user service client.
Do not create local token service.

## loginUser.route.ts

This file registers only:

```txt
POST /auth/login
```

Responsibilities:

```txt
- register POST /auth/login
- parse request body
- check basic HTTP input shape
- call loginUser usecase
- return response using SDK response helper if available
```

Allowed here:

```txt
Fastify request/reply
SDK sendSuccess
basic request body shape validation
```

Not allowed here:

```txt
Tomorrow School login
JWT generation
Kafka publish
user-service business flow
business policy
```

Suggested shape:

```ts
import type { FastifyInstance } from "fastify";
import type { LoginUserInput } from "./loginUser.input";
import type { LoginUserOutput } from "./loginUser.output";

export async function registerLoginUserRoute(
  app: FastifyInstance,
  deps: {
    loginUser: (input: LoginUserInput) => Promise<LoginUserOutput>;
    sendSuccess?: (reply: unknown, data: unknown) => unknown;
  },
) {
  app.post("/auth/login", async (request, reply) => {
    const body = request.body as Partial<LoginUserInput>;

    if (typeof body.login !== "string" || typeof body.password !== "string") {
      throw new Error("Invalid login request");
    }

    const result = await deps.loginUser({
      login: body.login,
      password: body.password,
    });

    if (deps.sendSuccess) {
      return deps.sendSuccess(reply, result);
    }

    return reply.send(result);
  });
}
```

Use actual SDK response helper if available.

---

# logoutUser module

Create:

```txt
src/domains/auth/logoutUser/logoutUser.ts
src/domains/auth/logoutUser/logoutUser.input.ts
src/domains/auth/logoutUser/logoutUser.output.ts
src/domains/auth/logoutUser/logoutUser.route.ts
src/domains/auth/logoutUser/index.ts
```

## logoutUser.input.ts

```ts
export type LogoutUserInput = {
  userId: string;
};
```

## logoutUser.output.ts

```ts
export type LogoutUserOutput = {
  success: true;
};
```

## logoutUser.ts

Responsibilities:

```txt
- receive current user id
- publish logout event through SDK Kafka/eventBus
- return success
```

Suggested shape:

```ts
import type { LogoutUserInput } from "./logoutUser.input";
import type { LogoutUserOutput } from "./logoutUser.output";

export function createLogoutUser(deps: {
  eventBus: {
    publish(event: {
      topic: string;
      key: string;
      value: unknown;
    }): Promise<void>;
  };
}) {
  return async function logoutUser(input: LogoutUserInput): Promise<LogoutUserOutput> {
    await deps.eventBus.publish({
      topic: "auth.user.logged_out",
      key: input.userId,
      value: {
        userId: input.userId,
        occurredAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
    };
  };
}
```

If JWT is stateless, do not create session table.
Do not invent token invalidation unless SDK already supports it.

## logoutUser.route.ts

This file registers only:

```txt
POST /auth/logout
```

Responsibilities:

```txt
- require bearer auth using SDK helper
- get current user id from SDK auth context
- call logoutUser
- return success
```

Suggested shape:

```ts
import type { FastifyInstance } from "fastify";
import type { LogoutUserInput } from "./logoutUser.input";
import type { LogoutUserOutput } from "./logoutUser.output";

export async function registerLogoutUserRoute(
  app: FastifyInstance,
  deps: {
    logoutUser: (input: LogoutUserInput) => Promise<LogoutUserOutput>;
    bearerAuth: unknown;
    getCurrentUserId: (request: unknown) => string;
    sendSuccess?: (reply: unknown, data: unknown) => unknown;
  },
) {
  app.post("/auth/logout", { preHandler: deps.bearerAuth as any }, async (request, reply) => {
    const userId = deps.getCurrentUserId(request);

    const result = await deps.logoutUser({
      userId,
    });

    if (deps.sendSuccess) {
      return deps.sendSuccess(reply, result);
    }

    return reply.send(result);
  });
}
```

Adapt to real SDK bearerAuth / request user format.

---

# readCurrentUser module

Create:

```txt
src/domains/auth/readCurrentUser/readCurrentUser.ts
src/domains/auth/readCurrentUser/readCurrentUser.input.ts
src/domains/auth/readCurrentUser/readCurrentUser.output.ts
src/domains/auth/readCurrentUser/readCurrentUser.route.ts
src/domains/auth/readCurrentUser/index.ts
```

## readCurrentUser.input.ts

```ts
export type ReadCurrentUserInput = {
  userId: string;
};
```

## readCurrentUser.output.ts

```ts
import type { CurrentUser } from "../model/CurrentUser";

export type ReadCurrentUserOutput = {
  user: CurrentUser;
};
```

## readCurrentUser.ts

Responsibilities:

```txt
- receive current user id
- call SDK user-service client
- return current user
```

Suggested shape:

```ts
import type { CurrentUser } from "../model/CurrentUser";
import type { ReadCurrentUserInput } from "./readCurrentUser.input";
import type { ReadCurrentUserOutput } from "./readCurrentUser.output";

export function createReadCurrentUser(deps: {
  userService: {
    getCurrentUser(input: { userId: string }): Promise<CurrentUser>;
  };
}) {
  return async function readCurrentUser(
    input: ReadCurrentUserInput,
  ): Promise<ReadCurrentUserOutput> {
    const user = await deps.userService.getCurrentUser({
      userId: input.userId,
    });

    return {
      user,
    };
  };
}
```

Rules:

```txt
- auth-service can read user profile
- user-service owns user profile
- auth-service must not modify user profile directly
```

## readCurrentUser.route.ts

This file registers only:

```txt
GET /auth/me
```

Responsibilities:

```txt
- require bearer auth using SDK helper
- get current user id from SDK auth context
- call readCurrentUser
- return response
```

Suggested shape:

```ts
import type { FastifyInstance } from "fastify";
import type { ReadCurrentUserInput } from "./readCurrentUser.input";
import type { ReadCurrentUserOutput } from "./readCurrentUser.output";

export async function registerReadCurrentUserRoute(
  app: FastifyInstance,
  deps: {
    readCurrentUser: (input: ReadCurrentUserInput) => Promise<ReadCurrentUserOutput>;
    bearerAuth: unknown;
    getCurrentUserId: (request: unknown) => string;
    sendSuccess?: (reply: unknown, data: unknown) => unknown;
  },
) {
  app.get("/auth/me", { preHandler: deps.bearerAuth as any }, async (request, reply) => {
    const userId = deps.getCurrentUserId(request);

    const result = await deps.readCurrentUser({
      userId,
    });

    if (deps.sendSuccess) {
      return deps.sendSuccess(reply, result);
    }

    return reply.send(result);
  });
}
```

Adapt to real SDK bearerAuth / request user format.

---

# model files

Create:

```txt
src/domains/auth/model/AuthResponse.ts
src/domains/auth/model/CurrentUser.ts
```

## CurrentUser.ts

```ts
export type CurrentUser = {
  id: string;
  login?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};
```

## AuthResponse.ts

```ts
import type { CurrentUser } from "./CurrentUser";

export type AuthResponse = {
  accessToken: string;
  user: CurrentUser;
};
```

Do not create a full User model.
Do not include repository, exam, question, profile ownership, or unrelated fields.

---

# index files

Each usecase folder should export its own files.

Example:

```ts
export * from "./loginUser";
export * from "./loginUser.input";
export * from "./loginUser.output";
export * from "./loginUser.route";
```

Auth domain index:

```ts
export * from "./loginUser";
export * from "./logoutUser";
export * from "./readCurrentUser";
export * from "./model/AuthResponse";
export * from "./model/CurrentUser";
```

Root `src/index.ts`:

```ts
export * from "./domains/auth";
```

---

# app.ts rule

`app.ts` may exist.

It should only:

```txt
- create Fastify app
- load SDK config/dependencies
- create usecases
- register each usecase route
- register SDK error handler if available
- return app
```

It must NOT contain business logic.

Suggested shape:

```ts
import Fastify from "fastify";
import {
  loadConfig,
  createTomorrowSchoolAuthClient,
  createUserServiceClient,
  createTokenService,
  createEventBus,
  sendSuccess,
  errorHandler,
  bearerAuth,
  getCurrentUserId,
} from "@backend/microservice-sdk";

import {
  createLoginUser,
  registerLoginUserRoute,
  createLogoutUser,
  registerLogoutUserRoute,
  createReadCurrentUser,
  registerReadCurrentUserRoute,
} from "./domains/auth";

export async function buildApp() {
  const app = Fastify();

  const config = loadConfig("auth-service");

  const tomorrowSchoolAuth = createTomorrowSchoolAuthClient(config);
  const userService = createUserServiceClient(config);
  const tokenService = createTokenService(config);
  const eventBus = createEventBus(config);

  const loginUser = createLoginUser({
    tomorrowSchoolAuth,
    userService,
    tokenService,
    eventBus,
  });

  const logoutUser = createLogoutUser({
    eventBus,
  });

  const readCurrentUser = createReadCurrentUser({
    userService,
  });

  app.setErrorHandler(errorHandler);

  await registerLoginUserRoute(app, {
    loginUser,
    sendSuccess,
  });

  await registerReadCurrentUserRoute(app, {
    readCurrentUser,
    bearerAuth,
    getCurrentUserId,
    sendSuccess,
  });

  await registerLogoutUserRoute(app, {
    logoutUser,
    bearerAuth,
    getCurrentUserId,
    sendSuccess,
  });

  return app;
}
```

Adapt exact SDK import names to real SDK exports.

Do not create local replacements if SDK already provides them.

---

# server.ts rule

`server.ts` may exist.

It should only:

```txt
- call buildApp()
- get port from SDK config if needed
- listen
- log startup
```

No business logic.

---

# Kafka rule

Kafka can be used.

But:

```txt
- do not import kafkajs inside auth-service
- do not create Kafka producer inside auth-service
- do not create event/ folder
- do not create event classes
```

Use SDK event bus only:

```ts
await deps.eventBus.publish({
  topic: "auth.user.logged_in",
  key: user.id,
  value: {
    userId: user.id,
    provider: "tomorrow_school",
    occurredAt: new Date().toISOString(),
  },
});
```

Required topics:

```txt
auth.user.logged_in
auth.user.logged_out
```

---

# Remove old architecture

Delete or migrate away from:

```txt
src/config/
src/clients/
src/controllers/
src/routes/
src/validation/
src/middlewares/
src/models/
src/repositories/
src/services/
src/shared/
src/domain/
src/types/
```

Replace `src/domain/` with `src/domains/`.

Keep only:

```txt
src/app.ts
src/server.ts
src/index.ts
src/domains/auth/**
```

---

# Dependency rule

Use dependency injection.

Usecases must receive SDK services as dependencies.

Preferred:

```ts
createLoginUser({
  tomorrowSchoolAuth,
  userService,
  tokenService,
  eventBus,
});
```

Not preferred:

```ts
import { eventBus } from "@backend/microservice-sdk";
```

Reason:

```txt
Dependency injection makes usecases easier to test and keeps business logic clean.
```

Route files may receive SDK helpers through dependencies too.

---

# Testing requirements

Test usecases without real Fastify and without real Kafka.

Mock:

```txt
tomorrowSchoolAuth
userService
tokenService
eventBus
```

Required tests:

```txt
loginUser:
- validates login input
- logs in with Tomorrow School auth
- creates/finds local user
- signs token
- publishes auth.user.logged_in through eventBus
- returns accessToken and user

logoutUser:
- publishes auth.user.logged_out through eventBus
- returns success

readCurrentUser:
- fetches current user from userService
- returns user
```

Route tests are optional for now.

Do not require real Kafka in unit tests.

---

# Final output required

After rewriting, output:

```txt
1. Final folder tree
2. Files created
3. Files moved
4. Files deleted
5. Files kept
6. Old folders removed
7. SDK dependencies used
8. Kafka topics used
9. Any SDK exports that were missing
10. TypeScript check result
11. Build result
12. Assumptions made
```

Expected final architecture sentence:

```txt
microservice-sdk provides config, HTTP helpers, JWT, Kafka eventBus, errors, clients, and common service tools.
auth-service owns auth business usecases and each usecase owns its own route registration file.
```

Important:

Do not over-engineer.
Do not add registerUser.
Do not add refreshSession.
Do not add local event folder.
Do not add local interface/http folder.
Do not add local types folder.
Do not add local shared folder.
Do not add local infrastructure folder.
Do not add local config folder.
Do not add local clients folder.
Do not add global controllers/routes/middlewares/validation folders.
Do not put all routes in one authRoutes.ts.
Each usecase registers its own route in its own `.route.ts` file.

backend/nodejs/services/auth-service

MUST FOLLOW:
Before rewriting auth-service, inspect @backend/microservice-sdk actual exports.
Do not invent SDK functions.
If an expected SDK helper is missing, report it under "SDK exports missing" and use the closest existing SDK export only if available.

MUST FOLLOW:Tests may be colocated beside usecases as:
loginUser.test.ts
logoutUser.test.ts
readCurrentUser.test.ts

MUST FOLLOW:Test files are allowed even though they are not shown in the target runtime tree.
Do not create a global tests/ folder ,DELETE the repo already use global tests/ folder if exits

MUST FOLLOW:Use SDK shared error classes/helpers for BadRequest, Unauthorized, and internal errors if available.
Do not throw plain Error for HTTP-facing validation unless no SDK error helper exists.

Route validation checks transport shape only.
Policy validation checks business rules only.
Do not put Fastify request/reply into policy.

When parsing request.body, first ensure it is a non-null object before reading fields.
Do not add Fastify module augmentation. Use SDK request helper to extract current user id.

Access token payload should be minimal. Use userId only unless SDK contract requires more.
Do not put full user profile into JWT.

auth-service must not normalize, update, or merge user profile fields manually.
Pass external identity to user-service client and trust user-service response.
Kafka event payload need to have version
After deleting old folders, search the auth-service for imports referencing deleted paths and remove/update them.
All index.ts files must be pure barrel exports. No runtime initialization inside index.ts.
logoutUser.route.ts must not accept userId from client body. Use authenticated user id only.
External auth failure should become Unauthorized/401 through SDK error handling if available.
Do not leak external auth raw error messages to the client.
Never log, return, publish, or store password.
Never include password in events or error messages.
Do not introduce ports/adapters/application layers. The usecase factory dependency type inside the usecase file is enough.