You are a senior Node.js TypeScript backend engineer.

Your task is to rewrite and simplify:

```txt
backend/nodejs/services/api-gateway
```

into a small, clean API Gateway architecture.

The goal is:

```txt
SDK = reusable technical tools
api-gateway = HTTP entrypoint + auth guard + route matching + upstream proxying
```

Important architecture rule:

The api-gateway is NOT a business domain service.

It should NOT be rewritten into business usecases like auth-service.

Instead, api-gateway should be a small technical gateway with clear gateway modules:

```txt
- app bootstrap
- gateway route registration
- route matching
- upstream proxy client
- auth guard through SDK
```

The api-gateway should NOT own business logic.

It should NOT know how login works.
It should NOT know how users are created.
It should NOT know how questions are generated.
It should NOT know how repos are analyzed.
It only routes and proxies requests.

---

# Current service path

```txt
backend/nodejs/services/api-gateway
```

# Current problem

The current api-gateway has too many traditional folders:

```txt
src/config/
src/controllers/
src/services/
src/repositories/
src/middlewares/
src/utils/
src/validation/
src/models/
src/types/
src/routes/
```

This is too much for a small gateway.

Rewrite it into a smaller structure that is easy for coding agents to understand and modify.

---

# Core responsibility

The api-gateway should do only these things:

```txt
1. Start Fastify
2. Load config through SDK
3. Register public and protected gateway routes
4. Verify JWT bearer token for protected routes through SDK
5. Match incoming URL to upstream target
6. Forward request to upstream service
7. Return upstream response
8. Use SDK error handler / response helpers if available
```

The api-gateway should NOT do:

```txt
- auth business logic
- user profile logic
- question logic
- exam logic
- Gitea reading logic
- AI analysis logic
- database access
- Kafka / Redpanda event publishing
- local JWT implementation
- local auth client implementation
- local business service layer
```

---

# SDK responsibility

Before rewriting api-gateway, inspect actual exports from:

```txt
backend/nodejs/packages/microservice-sdk
```

The SDK should provide reusable technical tools such as:

```txt
- config/env loading
- logger helper if available
- Fastify app helpers if available
- sendSuccess / sendError helpers if available
- shared error handler
- shared error classes/helpers
- JWT verification
- bearer auth helper/middleware
- request auth context helper
- HTTP client helper if available
- shared contracts
```

Important:

Do not invent SDK functions.

If an expected SDK helper is missing, report it under:

```txt
SDK exports missing
```

Use the closest existing SDK export only if available.

Do not create local replacements if the SDK already provides them.

---

# Target folder structure

Rewrite api-gateway into this structure:

```txt
backend/nodejs/services/api-gateway/
├── package.json
├── tsconfig.json
│
└── src/
    ├── app.ts
    ├── server.ts
    ├── index.ts
    │
    └── gateway/
        ├── registerGatewayRoutes.ts
        ├── routeTable.ts
        ├── matchGatewayRoute.ts
        ├── proxyRequest.ts
        ├── GatewayRoute.ts
        ├── GatewayProxyResult.ts
        └── index.ts
```

Optional only if actually needed:

```txt
src/gateway/getRequestBody.ts
src/gateway/copyProxyHeaders.ts
src/gateway/createGatewayAuthGuard.ts
```

Do not create folders unless they are truly needed.

---

# Do NOT create these folders

```txt
src/config/
src/controllers/
src/services/
src/repositories/
src/middlewares/
src/utils/
src/validation/
src/models/
src/types/
src/routes/
src/shared/
src/infrastructure/
src/interface/
src/interface/http/
src/domain/
src/domains/
```

api-gateway is not a domain service.

Do not create:

```txt
gatewayController.ts
gatewayService.ts
proxyRepository.ts
routeValidation.ts
bearerAuth.ts
jwt.ts
authRoutes.ts
types/fastify.d.ts
```

---

# Required gateway files

Create or keep only these runtime files:

```txt
src/app.ts
src/server.ts
src/index.ts
src/gateway/registerGatewayRoutes.ts
src/gateway/routeTable.ts
src/gateway/matchGatewayRoute.ts
src/gateway/proxyRequest.ts
src/gateway/GatewayRoute.ts
src/gateway/GatewayProxyResult.ts
src/gateway/index.ts
```

Test files are allowed beside the module files, for example:

```txt
src/gateway/matchGatewayRoute.test.ts
src/gateway/proxyRequest.test.ts
```

Do not create a global `test/` folder.

If a global `test/` folder already exists for api-gateway, migrate or delete it.

---

# GatewayRoute.ts

Define the gateway route contract here.

Suggested shape:

```ts
export type GatewayRoute = {
  method?: string;
  path: string;
  upstreamBaseUrl: string;
  upstreamPath?: string;
  protected: boolean;
};
```

Rules:

```txt
- path is the public gateway path pattern
- upstreamBaseUrl is the target service base URL
- upstreamPath is optional if target path differs
- protected decides whether bearer auth is required
```

Example:

```ts
{
  method: "GET",
  path: "/auth/me",
  upstreamBaseUrl: config.authServiceUrl,
  protected: true,
}
```

If method is omitted, match all methods.

---

# GatewayProxyResult.ts

Define the proxy response shape here.

Suggested shape:

```ts
export type GatewayProxyResult = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};
```

Adapt this to current implementation if response body is Buffer/string/json.

Do not over-engineer streaming unless the current gateway already needs it.

---

# routeTable.ts

This file owns the route mapping only.

Responsibilities:

```txt
- define all gateway route mappings
- mark public/protected routes
- map frontend-facing paths to upstream services
```

Suggested shape:

```ts
import type { GatewayRoute } from "./GatewayRoute";

export function createGatewayRouteTable(config: {
  authServiceUrl: string;
  userServiceUrl?: string;
  giteaReaderServiceUrl?: string;
  analysisServiceUrl?: string;
  questionServiceUrl?: string;
  examServiceUrl?: string;
}): GatewayRoute[] {
  return [
    {
      method: "POST",
      path: "/auth/login",
      upstreamBaseUrl: config.authServiceUrl,
      protected: false,
    },
    {
      method: "POST",
      path: "/auth/logout",
      upstreamBaseUrl: config.authServiceUrl,
      protected: true,
    },
    {
      method: "GET",
      path: "/auth/me",
      upstreamBaseUrl: config.authServiceUrl,
      protected: true,
    },
  ];
}
```

Then include existing current gateway routes from the real code.

Do not invent unnecessary routes.

Preserve existing route behavior unless it conflicts with this architecture.

---

# Route examples

Support routes like these if they already exist or are needed by the current project:

```txt
POST /auth/login              -> auth-service
POST /auth/logout             -> auth-service
GET  /auth/me                 -> auth-service

GET  /repositories            -> gitea-reader-service
POST /repositories/check      -> gitea-reader-service
POST /analysis-jobs           -> analysis-service
GET  /analysis-jobs/:id       -> analysis-service
GET  /analysis-jobs/:id/questions -> question-service
POST /exams                   -> exam-service
GET  /exams/:id               -> exam-service
POST /exams/:id/submit        -> exam-service
```

But do not add these blindly.

First inspect the existing route mapping.

Then migrate existing mappings into `routeTable.ts`.

---

# matchGatewayRoute.ts

This file matches an incoming request to a route from the route table.

Responsibilities:

```txt
- match HTTP method
- match static paths
- match dynamic params like /analysis-jobs/:id/questions
- return matched route and resolved upstream URL/path
- return null if no route matches
```

Suggested shape:

```ts
import type { GatewayRoute } from "./GatewayRoute";

export type MatchedGatewayRoute = {
  route: GatewayRoute;
  upstreamUrl: string;
};

export function matchGatewayRoute(input: {
  method: string;
  url: string;
  routes: GatewayRoute[];
}): MatchedGatewayRoute | null {
  // implement matching here
}
```

Rules:

```txt
- This file must be pure.
- No Fastify imports.
- No network calls.
- No SDK imports unless absolutely necessary.
- Unit test this file.
```

Do not call this `validation`.

This is not validation.

This is gateway route matching.

---

# proxyRequest.ts

This file forwards the request to upstream service.

Responsibilities:

```txt
- forward method
- forward headers safely
- forward query string
- forward request body
- call upstream URL
- return upstream status, headers, body
```

Suggested shape:

```ts
import type { GatewayProxyResult } from "./GatewayProxyResult";

export async function proxyRequest(input: {
  method: string;
  upstreamUrl: string;
  headers: Record<string, unknown>;
  body?: unknown;
}): Promise<GatewayProxyResult> {
  // use SDK HTTP client if available
  // otherwise use fetch if current runtime supports it
}
```

Rules:

```txt
- Prefer SDK HTTP client if available.
- If SDK does not provide one, use native fetch.
- Do not use axios unless already used and required.
- Do not create repository layer.
- Do not call this proxyRepository.
- Do not import business clients.
```

Header rules:

```txt
- forward Authorization only if needed by upstream
- forward Content-Type
- forward request id / correlation id if available
- do not blindly forward hop-by-hop headers
```

Do not forward these headers:

```txt
connection
keep-alive
proxy-authenticate
proxy-authorization
te
trailer
transfer-encoding
upgrade
host
content-length
```

---

# registerGatewayRoutes.ts

This file registers Fastify routes.

Responsibilities:

```txt
- register catch-all gateway route
- find matching gateway route
- run bearer auth for protected routes
- proxy request to upstream
- send upstream response back to client
```

Suggested shape:

```ts
import type { FastifyInstance } from "fastify";
import type { GatewayRoute } from "./GatewayRoute";
import { matchGatewayRoute } from "./matchGatewayRoute";
import { proxyRequest } from "./proxyRequest";

export async function registerGatewayRoutes(
  app: FastifyInstance,
  deps: {
    routes: GatewayRoute[];
    bearerAuth?: unknown;
    sendSuccess?: (reply: unknown, data: unknown) => unknown;
  },
) {
  app.all("/*", async (request, reply) => {
    const matched = matchGatewayRoute({
      method: request.method,
      url: request.url,
      routes: deps.routes,
    });

    if (!matched) {
      return reply.status(404).send({
        error: "Route not found",
      });
    }

    if (matched.route.protected) {
      // Use SDK bearerAuth helper correctly.
      // Adapt this section to actual SDK auth helper shape.
      // Do not implement JWT verification locally.
    }

    const result = await proxyRequest({
      method: request.method,
      upstreamUrl: matched.upstreamUrl,
      headers: request.headers,
      body: request.body,
    });

    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== undefined) {
        reply.header(key, value);
      }
    }

    return reply.status(result.statusCode).send(result.body);
  });
}
```

Adapt this to real SDK bearer auth shape.

If SDK bearer auth is a Fastify preHandler, you may create two catch-all routes:

```txt
1. public catch-all
2. protected catch-all
```

Or register each route individually.

Choose the simplest implementation that works with Fastify and current tests.

Do not implement local JWT verification.

---

# app.ts rule

`app.ts` may exist.

It should only:

```txt
- create Fastify app
- load SDK config
- create gateway route table
- register gateway routes
- register CORS if current service already uses it
- register SDK error handler if available
- return app
```

It must NOT contain route matching logic.

It must NOT contain proxy logic.

It must NOT contain JWT verification logic.

Suggested shape:

```ts
import Fastify from "fastify";
import {
  loadConfig,
  errorHandler,
  bearerAuth,
} from "@backend/microservice-sdk";

import {
  createGatewayRouteTable,
  registerGatewayRoutes,
} from "./gateway";

export async function buildApp() {
  const app = Fastify();

  const config = loadConfig("api-gateway");

  app.setErrorHandler(errorHandler);

  const routes = createGatewayRouteTable({
    authServiceUrl: config.authServiceUrl,
    userServiceUrl: config.userServiceUrl,
    giteaReaderServiceUrl: config.giteaReaderServiceUrl,
    analysisServiceUrl: config.analysisServiceUrl,
    questionServiceUrl: config.questionServiceUrl,
    examServiceUrl: config.examServiceUrl,
  });

  await registerGatewayRoutes(app, {
    routes,
    bearerAuth,
  });

  return app;
}
```

Adapt exact SDK import names to actual SDK exports.

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

No route matching.

No proxy logic.

No JWT logic.

No business logic.

---

# index.ts rule

Root `src/index.ts` should be pure barrel exports only:

```ts
export * from "./gateway";
```

No runtime initialization inside `index.ts`.

Gateway index:

```ts
export * from "./GatewayRoute";
export * from "./GatewayProxyResult";
export * from "./routeTable";
export * from "./matchGatewayRoute";
export * from "./proxyRequest";
export * from "./registerGatewayRoutes";
```

No side effects.

---

# Auth rule

The api-gateway may verify JWT for protected routes.

But it must use SDK auth helpers.

Allowed:

```txt
- SDK bearer auth middleware/helper
- SDK token verifier
- SDK request auth context helper
```

Not allowed:

```txt
- local utils/jwt.ts
- local bearerAuth.ts
- local JWT secret parsing
- local Fastify module augmentation
- local auth middleware folder
```

Access token payload should be minimal.

The gateway should only care about:

```txt
userId
```

Do not put full user profile into JWT.

Do not decode and trust full user profile in the gateway.

---

# Upstream auth forwarding rule

For protected routes, after JWT verification, the gateway may forward identity to upstream.

Prefer one of these depending on existing SDK convention:

```txt
Authorization: Bearer <original token>
```



Use the current project convention if it exists.

Do not invent multiple competing conventions.

If no convention exists, prefer forwarding the original Authorization header and let downstream services optionally verify through SDK.

---

# Error handling rule

Use SDK shared error classes/helpers if available:

```txt
BadRequest
Unauthorized
NotFound
InternalServerError
```

If SDK has no error helper, report it under:

```txt
SDK exports missing
```

Do not throw plain Error for HTTP-facing validation unless no SDK error helper exists.

For unmatched gateway route, return 404.

For upstream failure, return clean gateway error.

Do not leak raw internal stack traces.

Do not leak upstream private error details unless current behavior intentionally forwards upstream body.

---

# Config rule

Do not create local config folder.

Use SDK config loading.

Required config values should come from SDK config system:

```txt
API_GATEWAY_PORT
AUTH_SERVICE_URL
USER_SERVICE_URL
GITEA_READER_SERVICE_URL
ANALYSIS_SERVICE_URL
QUESTION_SERVICE_URL
EXAM_SERVICE_URL
FRONTEND_ORIGIN
JWT_SECRET
```

Only include values that are actually used by existing routes.

Do not hardcode localhost URLs inside gateway source code unless current dev config already does it and SDK config is missing.

---

# CORS rule

If current api-gateway supports CORS, preserve it.

But do not create a local CORS middleware folder.

Use:

```txt
- Fastify CORS plugin directly in app.ts
```

or:

```txt
- SDK Fastify helper if available
```

Allowed in `app.ts`.

---

# Logging rule

Use SDK logger if available.

If SDK logger is missing, use Fastify logger.

Do not create local logger helper.

Do not log:

```txt
Authorization header
JWT token
password
request body containing credentials
```

Especially for `/auth/login`, never log password.

---

# Redpanda / Kafka rule

The api-gateway should not publish events.

Do not add Kafka or Redpanda to api-gateway.

Do not import:

```txt
kafkajs
```

Do not create:

```txt
eventBus
producer
consumer
event/
```

Redpanda/Kafka belongs in SDK or business services when needed, not in api-gateway.

---

# Remove old architecture

Delete or migrate away from:

```txt
src/config/
src/controllers/
src/services/
src/repositories/
src/middlewares/
src/utils/
src/validation/
src/models/
src/types/
src/routes/
```

Replace them with:

```txt
src/gateway/
```

Keep only:

```txt
src/app.ts
src/server.ts
src/index.ts
src/gateway/**
```

After deleting old folders, search api-gateway for imports referencing deleted paths and remove/update them.

---

# Testing requirements

Test pure gateway logic without real Fastify and without real upstream service when possible.

Required tests:

```txt
matchGatewayRoute:
- matches static route
- matches dynamic route param like /analysis-jobs/:id/questions
- respects HTTP method
- returns null for unknown route
- preserves query string in upstream URL if expected

proxyRequest:
- forwards method
- forwards body
- strips hop-by-hop headers
- returns upstream status and body
```

Route tests are optional for now.

Do not require real upstream services in unit tests.

Do not require real JWT signing in gateway tests unless current tests already do it.

Mock SDK bearer auth if needed.

---

# Package rule

Keep package scripts simple.

Expected scripts:

```json
{
  "dev": "tsx src/server.ts",
  "build": "tsc -p tsconfig.json",
  "test": "node --test"
}
```

Adapt to current repo conventions.

Do not add unnecessary build tools.

---

# Migration behavior

Preserve current externally visible behavior unless it conflicts with the new architecture.

Before changing code:

```txt
1. Inspect current api-gateway files
2. Inspect current route mappings
3. Inspect current tests
4. Inspect @backend/microservice-sdk exports
5. Then rewrite
```

Do not guess route names.

Do not invent service URLs if current code already has config names.

Do not invent SDK exports.

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
7. Gateway routes preserved
8. Public routes
9. Protected routes
10. SDK dependencies used
11. SDK exports missing
12. TypeScript check result
13. Test result
14. Build result
15. Assumptions made
```

Expected final architecture sentence:

```txt
microservice-sdk provides config, auth/JWT helpers, HTTP/error helpers, logger, and common service tools.
api-gateway owns only gateway route mapping, route matching, auth guarding, and upstream proxying.
```

Important:

Do not over-engineer.
Do not create business usecases.
Do not create domain folders.
Do not create controllers/services/repositories/middlewares/validation/types/config folders.
Do not create local JWT implementation.
Do not create local bearer auth implementation.
Do not create local Kafka/Redpanda implementation.
Do not add database.
Do not add event publishing.
Do not add business clients.
Do not put all logic in app.ts.
Do not put route matching inside proxyRequest.ts.
Do not put proxy network code inside matchGatewayRoute.ts.
Do not put runtime initialization inside index.ts.
Do not log passwords, JWTs, or Authorization headers.
Do not leak raw auth/upstream internal errors.
Do not add Fastify module augmentation.
Use SDK helpers wherever they actually exist.
Report missing SDK helpers instead of inventing them.
