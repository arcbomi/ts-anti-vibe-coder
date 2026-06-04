# Tomorrow School Auth Usage

## Overview

The backend logs users in through Tomorrow School's signin endpoint:

- `POST https://01.tomorrow-school.ai/api/auth/signin`

This upstream API does not use a JSON request body for credentials. It expects HTTP Basic auth and returns either:

- `HTTP 200` with a bare JSON string containing the remote JWT when credentials are correct
- `HTTP 403` with `{"error":"User does not exist or password incorrect"}` when credentials are wrong

## Simple Usage

Use this auth stack in three separate steps:

1. Call Tomorrow School signin to get an upstream JWT.
2. Let this platform exchange that upstream proof for its own internal JWT.
3. Use the internal JWT for this platform's `/auth`, `/repositories`, `/analysis-jobs`, `/questions`, and `/exams` APIs.

Important:

- The Tomorrow School JWT is upstream proof only.
- The platform's own JWT is the token used by this repo's backend services.
- Gitea web auth under `/git` is not a direct `Authorization: Bearer <tomorrow-school-jwt>` flow.

## Which Token To Use

Use the correct token for the correct system:

| Token | Where it comes from | Where to use it | Do not use it for |
| --- | --- | --- | --- |
| Tomorrow School JWT | `https://01.tomorrow-school.ai/api/auth/signin` | Tomorrow School APIs, especially Hasura GraphQL | This repo's backend API authentication and direct Gitea login |
| Platform JWT | `POST /auth/login` in this repo | `/auth/me`, `/repositories`, `/analysis-jobs`, `/questions`, `/exams` | Tomorrow School GraphQL and direct Gitea OAuth replacement |
| Gitea session cookie | Browser login through `/git/user/oauth2/01-platform` | Gitea web UI under `/git` | Backend bearer-token APIs in this repo |

If you only remember one rule, remember this:

- Tomorrow School JWT proves who you are to Tomorrow School.
- Platform JWT proves who you are to this repo's backend.
- Gitea login is still a browser OAuth session flow.

## End-To-End Examples

### Example 1: Get a Tomorrow School JWT

This is the upstream login request. It uses HTTP Basic auth, not a JSON request body.

```bash
printf '%s' 'student-user:correct-password' | base64
```

Example request:

```bash
curl -i -X POST 'https://01.tomorrow-school.ai/api/auth/signin' \
  -H 'Accept: */*' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic <base64(username-or-email:password)>' \
  -H 'Cache-Control: no-cache' \
  -H 'Pragma: no-cache' \
  -H 'X-Jwt-Token: undefined' \
  -H 'Referer: https://01.tomorrow-school.ai/?show-password=1'
```

Success response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
"<tomorrow-school-jwt>"
```

Failure response:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
```

```json
{"error":"User does not exist or password incorrect"}
```

### Example 2: Exchange credentials through this platform and get the platform JWT

The frontend and backend in this repo do not ask you to send the Tomorrow School JWT manually. Instead, you call this repo's auth endpoint with the credential and password, and the backend does the Tomorrow School signin internally.

Request:

```bash
curl -i -X POST 'http://localhost:8080/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "credential": "student-user",
    "password": "correct-password"
  }'
```

Success response shape from this repo:

```json
{
  "success": true,
  "data": {
    "access_token": "<platform-jwt>",
    "user": {
      "id": "user-id",
      "email": "student@example.com",
      "name": "Student User",
      "full_name": "Student User"
    }
  },
  "error": null
}
```

The important detail here is that `access_token` is this platform's JWT, not the raw Tomorrow School JWT.

### Example 3: Use the platform JWT with protected backend APIs

After login, use the returned `access_token` against this repo's protected APIs.

Request:

```bash
curl -i 'http://localhost:8080/auth/me' \
  -H 'Authorization: Bearer <platform-jwt>' \
  -H 'Accept: application/json'
```

Example response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "student@example.com",
      "name": "Student User",
      "full_name": "Student User"
    }
  },
  "error": null
}
```

Another protected API example:

```bash
curl -i -X POST 'http://localhost:8080/repositories' \
  -H 'Authorization: Bearer <platform-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{
    "gitea_repo_url": "https://gitea.com/group/project"
  }'
```

### Example 4: Use the Tomorrow School JWT with GraphQL

If you need Tomorrow School data directly, use the Tomorrow School JWT as a bearer token for Hasura GraphQL.

HTTP example:

```bash
curl 'https://01.tomorrow-school.ai/api/graphql-engine/v1/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <tomorrow-school-jwt>' \
  -H 'X-Hasura-Role: user' \
  -d '{
    "query": "query UserById($userId: Int!) { user: user_by_pk(id: $userId) { id login email firstName lastName } }",
    "variables": {
      "userId": 15909
    }
  }'
```

Example response:

```json
{
  "data": {
    "user": {
      "id": 15909,
      "login": "student-user",
      "email": "student@example.com",
      "firstName": "Student",
      "lastName": "User"
    }
  }
}
```

## Curl Example

Use a Basic auth header with `username-or-email:password`:

```bash
curl -i -X POST 'https://01.tomorrow-school.ai/api/auth/signin' \
  -H 'Accept: */*' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic <base64(username-or-email:password)>' \
  -H 'Cache-Control: no-cache' \
  -H 'Pragma: no-cache' \
  -H 'X-Jwt-Token: undefined' \
  -H 'Referer: https://01.tomorrow-school.ai/?show-password=1'
```

Example Basic value for `dmukhat:<password>`:

```txt
Basic ZG11a2hhdDpwYXNzd29yZA==
```

Generate that value locally with:

```bash
printf '%s' 'username-or-email:password' | base64
```

## Observed Live Responses

Successful signin returns `HTTP 200` and a JSON string token:

```json
"<tomorrow-school-jwt>"
```

Invalid credentials return `HTTP 403`:

```json
{"error":"User does not exist or password incorrect"}
```

## Backend Integration Notes

The backend auth client now handles both of these upstream behaviors:

- It accepts the bare JSON string token format.
- It still accepts object-shaped responses such as `{"jwt":"..."}` if Tomorrow School changes back.
- When the upstream response contains no user profile, the backend derives a stable internal identity from the JWT claims and the submitted credential so username logins still work.

The platform does not expose or trust the Tomorrow School JWT directly. It only uses that token as proof of external authentication, then issues its own local JWT for the rest of the system.

## Gitea Auth From JWT

Short answer: you cannot log in to Gitea by sending the Tomorrow School JWT directly as a bearer token.

### Why This Fails

Even though Gitea login is connected to the same upstream identity provider, these are still different auth layers:

1. Tomorrow School issues an identity token for Tomorrow School.
2. Gitea uses OAuth login with Tomorrow School as its external provider.
3. After OAuth succeeds, Gitea creates its own authenticated session.
4. Gitea then expects either:
   - its own browser session cookies for web usage, or
   - a Gitea-recognized API credential such as username/password or token

So the Tomorrow School JWT is not automatically a Gitea API token.
Gitea does not treat `Authorization: Bearer <tomorrow-school-jwt>` as "this user is already logged in".

Another way to say it:

- Tomorrow School JWT answers: "Tomorrow School authenticated this user."
- Gitea session answers: "Gitea completed its own OAuth login flow for this user."

Those are related, but not the same credential.

The live Gitea flow verified on June 5, 2026 is:

1. Open `/git/user/oauth2/01-platform`.
2. Gitea responds with `307 Temporary Redirect`.
3. The redirect target is `/?client_id=...&redirect_uri=https://01.tomorrow-school.ai/git/user/oauth2/01-platform/callback&response_type=code&scope=email+openid&state=...`.
4. After the upstream provider finishes login, Gitea completes `/git/user/oauth2/01-platform/callback?...` and creates its own web session cookies.

Also verified on June 5, 2026:

- `GET /git/api/v1/user` with `Authorization: Bearer not-a-real-jwt` returned `401`.
- The response body was `{"message":"invalid username, password or token",...}`.

That means:

- Use the Tomorrow School JWT for Tomorrow School APIs such as GraphQL.
- Use the platform JWT for this repo's backend APIs.
- Use the `/git/user/oauth2/01-platform` browser redirect flow for Gitea web login.
- Do not expect the Tomorrow School JWT alone to authenticate Gitea API or Gitea web routes.

### Detailed Auth Sequence

This is the practical sequence for Gitea web login:

1. User opens `https://01.tomorrow-school.ai/git/user/oauth2/01-platform`.
2. Gitea generates an OAuth `state` value and redirects to the upstream login page.
3. The browser goes to Tomorrow School with:
   - `client_id`
   - `redirect_uri`
   - `response_type=code`
   - `scope=email openid`
   - `state`
4. The user signs in at Tomorrow School.
5. Tomorrow School redirects the browser back to Gitea's callback:
   - `/git/user/oauth2/01-platform/callback?state=...&code=...`
6. Gitea validates the OAuth callback.
7. Gitea creates its own session cookies.
8. The browser uses those cookies for later `/git/...` requests.

The important detail is step 7.
The final credential for web usage is the Gitea session cookie, not the original upstream JWT.

### What Gitea Seems To Expect

From the verified behavior on June 5, 2026:

- `/git/user/login?...` returns HTML and sets Gitea cookies like `i_like_gitea` and `redirect_to`.
- `/git/user/oauth2/01-platform` returns `307 Temporary Redirect` into the upstream OAuth flow.
- `/git/api/v1/user` rejects a random bearer JWT with `401`.

That suggests the current deployment is using:

- browser cookie session auth for the web UI
- Gitea-native auth rules for API routes

It is not using "accept any valid Tomorrow School bearer JWT directly on `/git/api/v1/*`".

### Browser Example

If you want to open Gitea for a user, send them to:

```txt
https://01.tomorrow-school.ai/git/user/oauth2/01-platform
```

What happens next:

1. Gitea redirects the browser to Tomorrow School with `client_id`, `redirect_uri`, `response_type=code`, `scope=email openid`, and `state`.
2. The user signs in on Tomorrow School.
3. Tomorrow School redirects back to `/git/user/oauth2/01-platform/callback?...`.
4. Gitea creates its own session cookies.
5. The browser can now access pages under `/git`.

This is a browser session flow. It is different from backend bearer-token authentication.

If you are building a frontend button, the safe pattern is:

```ts
window.location.href = "https://01.tomorrow-school.ai/git/user/oauth2/01-platform";
```

Do not try to:

- fetch the Gitea OAuth URL with XHR and manually parse it
- attach the Tomorrow School JWT as a bearer header to Gitea pages
- replace the browser redirect with a custom local JWT flow

Gitea wants a normal browser redirect and callback cycle.

### Backend Or CLI Example

If you are writing backend code or a CLI tool, think carefully about the goal.

Case 1: you want Tomorrow School user data

- Use the Tomorrow School JWT directly with Tomorrow School GraphQL.

Case 2: you want this repo's backend APIs

- Use the platform JWT returned by `POST /auth/login`.

Case 3: you want Gitea web UI for a human user

- Redirect the user's browser to `/git/user/oauth2/01-platform`.

Case 4: you want machine access to Gitea API

- Do not assume the Tomorrow School JWT will work.
- You would need a Gitea-supported API credential model.
- That might be a Gitea access token, app token, or some server-side integration configured in Gitea itself.

This repo does not currently document a supported machine-to-machine Gitea API auth flow based on the Tomorrow School JWT alone.

### What Not To Do

This will not log you in to Gitea:

```bash
curl 'https://01.tomorrow-school.ai/git/api/v1/user' \
  -H 'Authorization: Bearer <tomorrow-school-jwt>'
```

The live behavior verified on June 5, 2026 returned:

```http
HTTP/1.1 401 Unauthorized
```

```json
{"message":"invalid username, password or token","url":"https://01.tomorrow-school.ai/git/api/swagger"}
```

Why that response matters:

- The request reached Gitea successfully.
- Gitea evaluated the bearer credential.
- Gitea did not recognize that bearer value as a valid Gitea login credential.
- So the failure is not "network problem" or "wrong endpoint shape".
- The failure is "wrong credential type for Gitea".

That is the key distinction.

### Decision Guide

If your code has a JWT and you are unsure where to send it, use this quick rule:

- Send `Tomorrow School JWT` only to Tomorrow School endpoints.
- Send `platform JWT` only to this repo's backend endpoints.
- Send users, not bearer tokens, to `Gitea OAuth URL` when the goal is Gitea web login.

Pseudo-code:

```txt
if target is /auth, /repositories, /analysis-jobs, /questions, /exams:
  use platform JWT

if target is /api/graphql-engine/v1/graphql:
  use Tomorrow School JWT

if target is /git and user should browse Gitea:
  redirect browser to /git/user/oauth2/01-platform

if target is /git/api/v1/*:
  do not assume Tomorrow School JWT works
```

So if someone asks, "how to get auth gite using jwt?", the correct answer is:

- You can get a Tomorrow School JWT.
- You can use that JWT for Tomorrow School GraphQL.
- You cannot directly turn that JWT into a Gitea logged-in API session by just sending it as a bearer token.
- For Gitea, use the OAuth redirect flow that starts at `/git/user/oauth2/01-platform`.

## GraphQL WebSocket Usage

Tomorrow School's Hasura GraphQL endpoint is also reachable over WebSocket:

- `wss://01.tomorrow-school.ai/api/graphql-engine/v1/graphql`

The live endpoint was verified on June 5, 2026 with a temporary Node.js `.cjs` script. It uses the legacy `graphql-ws` protocol rather than the newer `graphql-transport-ws` protocol.

### Required Handshake

1. Open a WebSocket connection with subprotocol `graphql-ws`.
2. Send `connection_init` with auth headers inside `payload.headers`.
3. Wait for `connection_ack`.
4. Send query operations with `type: "start"`.
5. Expect periodic keepalive messages with `type: "ka"`.
6. After receiving `data`, send `type: "stop"` for that operation id.
7. Wait for `type: "complete"` before closing the socket.

### Node.js `.cjs` Example

This example uses Node 24's built-in `WebSocket` and keeps secrets in environment variables:

```js
const endpoint = "wss://01.tomorrow-school.ai/api/graphql-engine/v1/graphql";
const authToken = process.env.TOMORROW_SCHOOL_BEARER_TOKEN;

const ws = new WebSocket(endpoint, "graphql-ws");

ws.addEventListener("open", () => {
  ws.send(
    JSON.stringify({
      type: "connection_init",
      payload: {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "x-hasura-role": "user",
        },
      },
    }),
  );
});

ws.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));

  if (message.type === "connection_ack") {
    ws.send(
      JSON.stringify({
        type: "start",
        id: "group",
        payload: {
          query: `
            query GroupForUserEvent($userId: Int!, $eventId: Int!) {
              group(
                where: {
                  members: { userId: { _eq: $userId } }
                  _or: [
                    { eventId: { _eq: $eventId } }
                    { event: { parentId: { _eq: $eventId } } }
                  ]
                }
              ) {
                id
                path
                status
              }
            }
          `,
          variables: {
            userId: Number(process.env.TOMORROW_SCHOOL_USER_ID),
            eventId: Number(process.env.TOMORROW_SCHOOL_EVENT_ID),
          },
        },
      }),
    );
  }

  if (message.type === "data" && message.id === "group") {
    console.log(JSON.stringify(message.payload, null, 2));
    ws.send(JSON.stringify({ type: "stop", id: "group" }));
  }
});
```

Run it like this:

```bash
TOMORROW_SCHOOL_BEARER_TOKEN='<jwt>' \
TOMORROW_SCHOOL_USER_ID='15909' \
TOMORROW_SCHOOL_EVENT_ID='96' \
node graphql-ws-test.cjs
```

### Example Queries

Group lookup by user membership and event:

```graphql
query GroupForUserEvent($userId: Int!, $eventId: Int!) {
  group(
    where: {
      members: { userId: { _eq: $userId } }
      _or: [
        { eventId: { _eq: $eventId } }
        { event: { parentId: { _eq: $eventId } } }
      ]
    }
  ) {
    id
    path
    status
    captainLogin
    captainId
    updatedAt
    event {
      id
      path
    }
  }
}
```

User lookup by primary key:

```graphql
query UserById($userId: Int!) {
  user: user_by_pk(id: $userId) {
    id
    login
    email
    campus
    firstName
    lastName
    auditRatio
    roles {
      slug
    }
    labels {
      labelName
      labelId
      eventId
    }
  }
}
```

### Observed Protocol Details

- The server may send `{"type":"ka"}` before or after `connection_ack`.
- Auth is passed in the `connection_init` payload, not as a later operation extension.
- Standard query responses arrive as `{"type":"data","id":"...","payload":{"data":...}}`.
- The server finishes each operation with `{"type":"complete","id":"..."}` after a matching `stop`.
- Do not commit live bearer tokens, real user ids, or raw response payloads because those can contain private user data.
