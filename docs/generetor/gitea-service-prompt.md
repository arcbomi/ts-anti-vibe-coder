You are a senior Node.js TypeScript backend engineer.

Your task is to re-architecture:

```txt
backend/nodejs/services/gitea-service
```

into a very small event-driven Git repository downloader service.

Important:

Do NOT build a full repository management service.

Do NOT add useless CRUD usecases.

Do NOT add HTTP repository management APIs.

Do NOT add analysis job logic.

Do NOT add safe file reading.

Do NOT add bot access checking as a separate usecase.

Do NOT use `GITEA_BOT_TOKEN`.

The only real business usecase needed now is:

```txt
downloadGitRepositoryFromTomorrowEvent
```

This service should consume Kafka/Redpanda events from `tomorrow-service`, read the user's Tomorrow JWT from the local user table / Tomorrow connection table, use that user token to find and download the matching Gitea repository, save download metadata, and publish a result event.

---

# Core architecture

Correct service boundary:

```txt
tomorrow-service
= discovers Tomorrow succeeded projects
= publishes event

gitea-service
= consumes event
= reads user's Tomorrow JWT from user table / connection table
= uses user's token to find/download Gitea repositories
= stores local repo download metadata
= publishes download result event

worker / ai-analysis-service
= later consumes downloaded repo event and analyzes code
```

Important sentence:

```txt
gitea-service is not a repository CRUD API.
gitea-service is not using a global Gitea bot token.
gitea-service is a repo downloader worker driven by Kafka/Redpanda events.
It uses the user's own Tomorrow JWT from local persistence.
```

---

# Required usecase

Only implement this usecase:

```txt
downloadGitRepositoryFromTomorrowEvent
```

Do NOT implement:

```txt
createRepository
listRepositories
getRepository
checkBotAccess
startRepositoryAnalysis
getAnalysisJob
readSafeRepositoryFiles
syncTomorrowProjects
installSucceededProjectsFromTomorrow
```

Those are too much for now.

---

# Event input

The service consumes this topic:

```txt
tomorrow.succeeded_projects.discovered
```

Expected payload:

```ts
export type TomorrowSucceededProjectsDiscoveredEvent = {
  version: 1;
  tomorrowUserId: string;
  tomorrowLogin: string;
  projects: Array<{
    projectName: string;
    projectSlug: string;
    status: "succeeded";
  }>;
  occurredAt: string;
};
```

Example:

```json
{
  "version": 1,
  "tomorrowUserId": "123",
  "tomorrowLogin": "dmukhat",
  "projects": [
    {
      "projectName": "go-reloaded",
      "projectSlug": "go-reloaded",
      "status": "succeeded"
    }
  ],
  "occurredAt": "2026-06-29T10:00:00.000Z"
}
```

---

# No GITEA_BOT_TOKEN rule

Do NOT use:

```txt
GITEA_BOT_TOKEN
```

Do NOT create a bot-token-based Gitea client.

Instead, gitea-service must read the user's Tomorrow JWT / Tomorrow access token from local persistence.

The token should be selected by:

```txt
tomorrowUserId
tomorrowLogin
```

Required dependency:

```ts
export type TomorrowConnectionStore = {
  ensureSchema(): Promise<void>;

  findByTomorrowIdentity(input: {
    tomorrowUserId: string;
    tomorrowLogin: string;
  }): Promise<{
    userId: string;
    tomorrowUserId: string;
    tomorrowLogin: string;
    tomorrowAccessToken: string;
  } | null>;
};
```

If the current project already stores Tomorrow JWT in the `users` table, implement this store as a thin reader over that existing table.

If the project already has a `user_connections` / `tomorrow_connections` table, use that instead.

Do NOT call tomorrow-service to get the token.

Do NOT ask the browser/user for the token.

Do NOT put token into the event.

Do NOT publish token.

Do NOT log token.

Do NOT return token.

Do NOT store token anywhere except the existing user connection table.

If no connection is found, do not crash the whole service. Return all projects as failed with reason:

```txt
Tomorrow credentials not found for user
```

---

# What the usecase should do

For each consumed event:

```txt
1. Validate event payload.
2. Load Tomorrow connection by tomorrowUserId + tomorrowLogin.
3. If no Tomorrow JWT is found, mark all projects failed.
4. Use tomorrowLogin as the Gitea owner/login.
5. Use projectSlug as expected repo name.
6. Ask Gitea API for actual repository metadata using the user's Tomorrow JWT.
7. If repo exists and user token can access it, get clone_url / html_url from Gitea response.
8. Download/clone the repo into a local workspace directory using the user's token.
9. Store download metadata.
10. Publish result event.
```

Important:

```txt
Do NOT trust generated URLs as final source of truth.
Do NOT just save `${GITEA_BASE_URL}/${tomorrowLogin}/${projectSlug}`.
Use Gitea API to confirm the repo exists and get the actual clone URL / html URL.
```

Allowed lookup:

```txt
GET /api/v1/repos/:owner/:repo
```

or equivalent Gitea API method.

Only after Gitea confirms the repo exists, use the returned clone URL to download.

---

# Gitea API auth rule

Gitea lookup client must use the user's Tomorrow JWT / access token.

Preferred interface:

```ts
export type GiteaRepoLookupClient = {
  getRepository(input: {
    owner: string;
    repo: string;
    accessToken: string;
  }): Promise<{
    id: string;
    owner: string;
    name: string;
    htmlUrl: string;
    cloneUrl: string;
    defaultBranch?: string;
  } | null>;
};
```

Implementation:

```txt
- calls Gitea REST API using GITEA_BASE_URL
- authenticates with the user's Tomorrow JWT / access token
- endpoint: GET /api/v1/repos/:owner/:repo
- returns null for 403/404
- throws safe AppError for provider failure
```

Authorization format should match the actual 01/Tomorrow/Gitea platform requirements.

Common options:

```txt
Authorization: Bearer <tomorrowAccessToken>
```

or if existing code/platform requires another header, use the actual working method.

Do NOT invent bot-token auth.

Do NOT log authorization header.

Do NOT publish authorization header.

---

# Download behavior

The service should download repository into a workspace folder.

Recommended path shape:

```txt
<GITEA_WORKSPACE_DIR>/<tomorrowUserId>/<projectSlug>/
```

Example:

```txt
/tmp/gitea-workspace/123/go-reloaded/
```

Rules:

```txt
- If folder already exists, update it with git fetch / reset.
- If folder does not exist, git clone it.
- Avoid path traversal.
- Sanitize tomorrowUserId and projectSlug before using them in filesystem path.
- Do not allow projectSlug to contain "../".
- Do not store token in path.
- Do not log user token.
```

Preferred download method:

```txt
Use git CLI through a small wrapper.
```

Allowed operations:

```txt
git clone <authenticatedCloneUrl> <targetDir>
git -C <targetDir> fetch --all --prune
git -C <targetDir> reset --hard origin/<defaultBranch>
git -C <targetDir> rev-parse HEAD
```

If the repo has a default branch from Gitea metadata, use it.

If missing, fallback to:

```txt
main
```

---

# Git clone auth rule

Downloader may receive the access token:

```ts
export type GitRepositoryDownloader = {
  downloadOrUpdate(input: {
    cloneUrl: string;
    accessToken: string;
    owner: string;
    repo: string;
    defaultBranch: string;
    tomorrowUserId: string;
    projectSlug: string;
  }): Promise<{
    localPath: string;
    commitSha?: string;
  }>;
};
```

But:

```txt
- Do NOT return accessToken.
- Do NOT publish accessToken.
- Do NOT log accessToken.
- Do NOT store accessToken in downloaded repository metadata.
- Do NOT include accessToken in localPath.
```

If clone URL needs token injection, keep token handling inside `createGitRepositoryDownloader.ts`.

Sanitize logs and command errors before throwing.

---

# Output event

After processing, publish:

```txt
gitea.repositories.downloaded
```

Payload:

```ts
export type GiteaRepositoriesDownloadedEvent = {
  version: 1;
  tomorrowUserId: string;
  tomorrowLogin: string;
  downloaded: Array<{
    projectName: string;
    projectSlug: string;
    giteaOwner: string;
    giteaRepo: string;
    giteaRepoUrl: string;
    localPath: string;
    defaultBranch: string;
    commitSha?: string;
  }>;
  failed: Array<{
    projectName: string;
    projectSlug: string;
    reason: string;
  }>;
  occurredAt: string;
};
```

Do NOT publish:

```txt
Gitea bot token
Tomorrow access token
Authorization header
password
raw external API error
full file contents
```

---

# Target folder structure

Rewrite toward this structure:

```txt
backend/nodejs/services/gitea-service/
├── package.json
├── tsconfig.json
│
└── src/
    ├── app.ts
    ├── server.ts
    ├── index.ts
    │
    └── domains/
        └── gitea/
            ├── downloadGitRepositoryFromTomorrowEvent/
            │   ├── downloadGitRepositoryFromTomorrowEvent.ts
            │   ├── downloadGitRepositoryFromTomorrowEvent.input.ts
            │   ├── downloadGitRepositoryFromTomorrowEvent.output.ts
            │   ├── downloadGitRepositoryFromTomorrowEvent.policy.ts
            │   ├── downloadGitRepositoryFromTomorrowEvent.handler.ts
            │   ├── downloadGitRepositoryFromTomorrowEvent.test.ts
            │   ├── shared/
            │   │   ├── TomorrowSucceededProjectsDiscoveredEvent.ts
            │   │   ├── GiteaRepositoriesDownloadedEvent.ts
            │   │   ├── TomorrowConnectionStore.ts
            │   │   ├── createTomorrowConnectionStore.ts
            │   │   ├── createGiteaRepoLookupClient.ts
            │   │   ├── GiteaRepoLookupClient.ts
            │   │   ├── createGitRepositoryDownloader.ts
            │   │   ├── GitRepositoryDownloader.ts
            │   │   ├── createDownloadedRepositoryStore.ts
            │   │   ├── DownloadedRepositoryStore.ts
            │   │   ├── sanitizeWorkspacePath.ts
            │   │   ├── publishGiteaRepositoriesDownloaded.ts
            │   │   └── index.ts
            │   └── index.ts
            │
            ├── model/
            │   ├── DownloadedRepository.ts
            │   ├── GiteaRepository.ts
            │   └── index.ts
            │
            └── index.ts
```

Do NOT create:

```txt
src/controllers/
src/routes/
src/services/
src/repositories/
src/utils/
src/validation/
src/middlewares/
src/shared/
src/clients/
src/models/
```

Allowed:

```txt
src/domains/gitea/downloadGitRepositoryFromTomorrowEvent/shared/
src/domains/gitea/model/
```

This is a worker-like service. It does not need HTTP routes except optional health check if the existing platform requires it.

---

# app.ts rule

`app.ts` should only:

```txt
- load config
- create logger
- create eventBus
- create Tomorrow connection store
- create Gitea repo lookup client
- create Git repository downloader
- create downloaded repository store
- create downloadGitRepositoryFromTomorrowEvent usecase
- register Kafka/Redpanda event handler
- return app if Fastify app is still needed for health
```

`app.ts` must NOT contain:

```txt
- Gitea fetch logic
- git CLI commands
- filesystem path building
- event payload business logic
- store implementation details
- token extraction logic
- SQL query details
```

Conceptual shape:

```ts
import {
  createEventBus,
  createFastifyApp,
  createLogger,
  loadConfig,
} from "@backend/microservice-sdk";

import {
  createDownloadGitRepositoryFromTomorrowEvent,
  registerDownloadGitRepositoryFromTomorrowEventHandler,
} from "./domains/gitea";

import {
  createTomorrowConnectionStore,
  createGiteaRepoLookupClient,
  createGitRepositoryDownloader,
  createDownloadedRepositoryStore,
} from "./domains/gitea/downloadGitRepositoryFromTomorrowEvent/shared";

export async function buildApp() {
  const config = loadConfig("gitea-service");

  const logger = createLogger({
    serviceName: config.serviceName,
    logLevel: config.logLevel,
  });

  const eventBus = createEventBus(config);

  const tomorrowConnectionStore = createTomorrowConnectionStore({
    config,
  });

  const giteaRepoLookupClient = createGiteaRepoLookupClient({
    config,
  });

  const gitRepositoryDownloader = createGitRepositoryDownloader({
    config,
  });

  const downloadedRepositoryStore = createDownloadedRepositoryStore({
    config,
  });

  await tomorrowConnectionStore.ensureSchema();
  await downloadedRepositoryStore.ensureSchema();

  const downloadGitRepositoryFromTomorrowEvent =
    createDownloadGitRepositoryFromTomorrowEvent({
      tomorrowConnectionStore,
      giteaRepoLookupClient,
      gitRepositoryDownloader,
      downloadedRepositoryStore,
      eventBus,
    });

  await registerDownloadGitRepositoryFromTomorrowEventHandler(eventBus, {
    downloadGitRepositoryFromTomorrowEvent,
  });

  const app = createFastifyApp({
    serviceName: config.serviceName,
    appEnv: config.appEnv,
    logger,
    registerRoutes(fastify) {
      fastify.get("/healthz", async () => ({ ok: true }));
    },
  });

  return app;
}
```

Adapt exact SDK exports to actual SDK.

Do not invent SDK helpers.

If SDK eventBus subscribe API is different, adapt to actual one.

---

# Usecase input

Create:

```txt
downloadGitRepositoryFromTomorrowEvent.input.ts
```

```ts
import type { TomorrowSucceededProjectsDiscoveredEvent } from "./shared/TomorrowSucceededProjectsDiscoveredEvent";

export type DownloadGitRepositoryFromTomorrowEventInput = {
  event: TomorrowSucceededProjectsDiscoveredEvent;
};
```

---

# Usecase output

Create:

```txt
downloadGitRepositoryFromTomorrowEvent.output.ts
```

```ts
import type { DownloadedRepository } from "../model/DownloadedRepository";

export type DownloadGitRepositoryFromTomorrowEventOutput = {
  downloadedCount: number;
  downloaded: DownloadedRepository[];
  failed: Array<{
    projectName: string;
    projectSlug: string;
    reason: string;
  }>;
  eventPublished: boolean;
};
```

---

# Usecase policy

Create:

```txt
downloadGitRepositoryFromTomorrowEvent.policy.ts
```

Responsibilities:

```txt
- validate event.version === 1
- validate tomorrowUserId
- validate tomorrowLogin
- validate projects array
- validate each projectName/projectSlug/status
- allow only status === "succeeded"
```

Use SDK BadRequestError or AppError if available.

Do not accept empty projectSlug.

Do not accept projectSlug containing path traversal.

---

# Usecase behavior

Create:

```txt
downloadGitRepositoryFromTomorrowEvent.ts
```

Responsibilities:

```txt
- validate input event
- load Tomorrow connection from local user table / connection table
- if no connection/token exists, return every project in failed[]
- loop through succeeded projects
- for each project:
  - ask Gitea API for repo metadata using tomorrowLogin + projectSlug + user's access token
  - if repo not found/access denied, add to failed[]
  - if repo exists, download/clone it using returned cloneUrl and user's access token
  - store downloaded repository metadata
- publish gitea.repositories.downloaded event
- return downloadedCount, downloaded, failed, eventPublished
```

Suggested shape:

```ts
import type { DownloadGitRepositoryFromTomorrowEventInput } from "./downloadGitRepositoryFromTomorrowEvent.input";
import type { DownloadGitRepositoryFromTomorrowEventOutput } from "./downloadGitRepositoryFromTomorrowEvent.output";
import { assertTomorrowSucceededProjectsDiscoveredEventAllowed } from "./downloadGitRepositoryFromTomorrowEvent.policy";
import { publishGiteaRepositoriesDownloaded } from "./shared";

export function createDownloadGitRepositoryFromTomorrowEvent(deps: {
  tomorrowConnectionStore: {
    findByTomorrowIdentity(input: {
      tomorrowUserId: string;
      tomorrowLogin: string;
    }): Promise<{
      userId: string;
      tomorrowUserId: string;
      tomorrowLogin: string;
      tomorrowAccessToken: string;
    } | null>;
  };

  giteaRepoLookupClient: {
    getRepository(input: {
      owner: string;
      repo: string;
      accessToken: string;
    }): Promise<{
      id: string;
      owner: string;
      name: string;
      htmlUrl: string;
      cloneUrl: string;
      defaultBranch?: string;
    } | null>;
  };

  gitRepositoryDownloader: {
    downloadOrUpdate(input: {
      cloneUrl: string;
      accessToken: string;
      owner: string;
      repo: string;
      defaultBranch: string;
      tomorrowUserId: string;
      projectSlug: string;
    }): Promise<{
      localPath: string;
      commitSha?: string;
    }>;
  };

  downloadedRepositoryStore: {
    upsertDownloadedRepository(input: {
      userId: string;
      tomorrowUserId: string;
      tomorrowLogin: string;
      projectName: string;
      projectSlug: string;
      giteaOwner: string;
      giteaRepo: string;
      giteaRepoUrl: string;
      cloneUrl: string;
      localPath: string;
      defaultBranch: string;
      commitSha?: string;
      downloadedAt: string;
    }): Promise<{
      id: string;
      userId: string;
      tomorrowUserId: string;
      tomorrowLogin: string;
      projectName: string;
      projectSlug: string;
      giteaOwner: string;
      giteaRepo: string;
      giteaRepoUrl: string;
      cloneUrl: string;
      localPath: string;
      defaultBranch: string;
      commitSha?: string;
      downloadedAt: string;
    }>;
  };

  eventBus?: {
    publish(event: {
      topic: string;
      key: string;
      value: unknown;
    }): Promise<void>;
  };
}) {
  return async function downloadGitRepositoryFromTomorrowEvent(
    input: DownloadGitRepositoryFromTomorrowEventInput,
  ): Promise<DownloadGitRepositoryFromTomorrowEventOutput> {
    assertTomorrowSucceededProjectsDiscoveredEventAllowed(input.event);

    const downloaded = [];
    const failed = [];

    const connection = await deps.tomorrowConnectionStore.findByTomorrowIdentity({
      tomorrowUserId: input.event.tomorrowUserId,
      tomorrowLogin: input.event.tomorrowLogin,
    });

    if (!connection?.tomorrowAccessToken) {
      for (const project of input.event.projects) {
        failed.push({
          projectName: project.projectName,
          projectSlug: project.projectSlug,
          reason: "Tomorrow credentials not found for user",
        });
      }

      return {
        downloadedCount: 0,
        downloaded,
        failed,
        eventPublished: false,
      };
    }

    for (const project of input.event.projects) {
      try {
        const repo = await deps.giteaRepoLookupClient.getRepository({
          owner: input.event.tomorrowLogin,
          repo: project.projectSlug,
          accessToken: connection.tomorrowAccessToken,
        });

        if (!repo) {
          failed.push({
            projectName: project.projectName,
            projectSlug: project.projectSlug,
            reason: "Gitea repository not found or user token has no access",
          });
          continue;
        }

        const defaultBranch = repo.defaultBranch || "main";

        const downloadResult = await deps.gitRepositoryDownloader.downloadOrUpdate({
          cloneUrl: repo.cloneUrl,
          accessToken: connection.tomorrowAccessToken,
          owner: repo.owner,
          repo: repo.name,
          defaultBranch,
          tomorrowUserId: input.event.tomorrowUserId,
          projectSlug: project.projectSlug,
        });

        const saved = await deps.downloadedRepositoryStore.upsertDownloadedRepository({
          userId: connection.userId,
          tomorrowUserId: input.event.tomorrowUserId,
          tomorrowLogin: input.event.tomorrowLogin,
          projectName: project.projectName,
          projectSlug: project.projectSlug,
          giteaOwner: repo.owner,
          giteaRepo: repo.name,
          giteaRepoUrl: repo.htmlUrl,
          cloneUrl: repo.cloneUrl,
          localPath: downloadResult.localPath,
          defaultBranch,
          commitSha: downloadResult.commitSha,
          downloadedAt: new Date().toISOString(),
        });

        downloaded.push(saved);
      } catch {
        failed.push({
          projectName: project.projectName,
          projectSlug: project.projectSlug,
          reason: "Repository download failed",
        });
      }
    }

    let eventPublished = false;

    if (deps.eventBus && (downloaded.length > 0 || failed.length > 0)) {
      await publishGiteaRepositoriesDownloaded(deps.eventBus, {
        version: 1,
        tomorrowUserId: input.event.tomorrowUserId,
        tomorrowLogin: input.event.tomorrowLogin,
        downloaded: downloaded.map((repo) => ({
          projectName: repo.projectName,
          projectSlug: repo.projectSlug,
          giteaOwner: repo.giteaOwner,
          giteaRepo: repo.giteaRepo,
          giteaRepoUrl: repo.giteaRepoUrl,
          localPath: repo.localPath,
          defaultBranch: repo.defaultBranch,
          commitSha: repo.commitSha,
        })),
        failed,
        occurredAt: new Date().toISOString(),
      });

      eventPublished = true;
    }

    return {
      downloadedCount: downloaded.length,
      downloaded,
      failed,
      eventPublished,
    };
  };
}
```

Important:

```txt
Do not include tomorrowAccessToken in returned output.
Do not include tomorrowAccessToken in failed reason.
Do not include raw external error in failed reason.
```

---

# Event handler

Create:

```txt
downloadGitRepositoryFromTomorrowEvent.handler.ts
```

It should subscribe to:

```txt
tomorrow.succeeded_projects.discovered
```

Suggested shape:

```ts
import type { DownloadGitRepositoryFromTomorrowEventInput } from "./downloadGitRepositoryFromTomorrowEvent.input";
import type { DownloadGitRepositoryFromTomorrowEventOutput } from "./downloadGitRepositoryFromTomorrowEvent.output";

export async function registerDownloadGitRepositoryFromTomorrowEventHandler(
  eventBus: {
    subscribe(input: {
      topic: string;
      handler: (message: unknown) => Promise<void>;
    }): Promise<void>;
  },
  deps: {
    downloadGitRepositoryFromTomorrowEvent: (
      input: DownloadGitRepositoryFromTomorrowEventInput,
    ) => Promise<DownloadGitRepositoryFromTomorrowEventOutput>;
  },
) {
  await eventBus.subscribe({
    topic: "tomorrow.succeeded_projects.discovered",
    handler: async (message) => {
      await deps.downloadGitRepositoryFromTomorrowEvent({
        event: message as DownloadGitRepositoryFromTomorrowEventInput["event"],
      });
    },
  });
}
```

Adapt to real SDK eventBus subscribe API.

Do not import kafkajs directly.

Do not create raw Kafka consumer in the usecase.

---

# Tomorrow connection store

Create:

```txt
shared/TomorrowConnectionStore.ts
shared/createTomorrowConnectionStore.ts
```

Interface:

```ts
export type TomorrowConnectionStore = {
  ensureSchema(): Promise<void>;

  findByTomorrowIdentity(input: {
    tomorrowUserId: string;
    tomorrowLogin: string;
  }): Promise<{
    userId: string;
    tomorrowUserId: string;
    tomorrowLogin: string;
    tomorrowAccessToken: string;
  } | null>;
};
```

Implementation rule:

```txt
- Read from existing users table or existing Tomorrow connection table.
- Do not create a second source of truth if one already exists.
- Do not expose tomorrowAccessToken outside the usecase dependencies.
- Do not log token.
```

If current table stores token under a different column name, adapt to actual schema.

If no schema exists, create a minimal `tomorrow_connections` table only if necessary:

```txt
tomorrow_connections
```

Suggested fields:

```txt
user_id
tomorrow_user_id
tomorrow_login
tomorrow_access_token
created_at
updated_at
```

Unique constraint:

```txt
unique(tomorrow_user_id, tomorrow_login)
```

But prefer existing user table if it already stores Tomorrow JWT.

---

# Gitea repo lookup client

Create:

```txt
shared/GiteaRepoLookupClient.ts
shared/createGiteaRepoLookupClient.ts
```

Interface:

```ts
export type GiteaRepoLookupClient = {
  getRepository(input: {
    owner: string;
    repo: string;
    accessToken: string;
  }): Promise<{
    id: string;
    owner: string;
    name: string;
    htmlUrl: string;
    cloneUrl: string;
    defaultBranch?: string;
  } | null>;
};
```

Implementation:

```txt
- calls Gitea REST API using GITEA_BASE_URL
- endpoint: GET /api/v1/repos/:owner/:repo
- authenticates with user's Tomorrow JWT / access token
- returns null for 403/404
- throws safe AppError for provider failure
```

Rules:

```txt
- Never log accessToken.
- Never return accessToken.
- Never publish accessToken.
- Do not use GITEA_BOT_TOKEN.
```

---

# Git repository downloader

Create:

```txt
shared/GitRepositoryDownloader.ts
shared/createGitRepositoryDownloader.ts
shared/sanitizeWorkspacePath.ts
```

Interface:

```ts
export type GitRepositoryDownloader = {
  downloadOrUpdate(input: {
    cloneUrl: string;
    accessToken: string;
    owner: string;
    repo: string;
    defaultBranch: string;
    tomorrowUserId: string;
    projectSlug: string;
  }): Promise<{
    localPath: string;
    commitSha?: string;
  }>;
};
```

Implementation rules:

```txt
- Use GITEA_WORKSPACE_DIR from config/env.
- Sanitize tomorrowUserId and projectSlug.
- Target path: <GITEA_WORKSPACE_DIR>/<tomorrowUserId>/<projectSlug>
- If target path does not exist, run git clone.
- If target path exists and is a git repo, run git fetch --all --prune and reset to origin/defaultBranch.
- If target path exists but is not a git repo, fail safely.
- Return localPath and current commit SHA if possible.
```

Allowed commands:

```txt
git clone <authenticatedCloneUrl> <targetPath>
git -C <targetPath> fetch --all --prune
git -C <targetPath> reset --hard origin/<defaultBranch>
git -C <targetPath> rev-parse HEAD
```

Must protect against:

```txt
- path traversal
- empty projectSlug
- writing outside workspace
- logging tokens
```

If token must be embedded into clone URL, create the authenticated clone URL inside this downloader only and scrub it from errors/logs.

---

# Downloaded repository store

Create:

```txt
shared/DownloadedRepositoryStore.ts
shared/createDownloadedRepositoryStore.ts
```

Model:

```ts
export type DownloadedRepository = {
  id: string;

  userId: string;

  tomorrowUserId: string;
  tomorrowLogin: string;

  projectName: string;
  projectSlug: string;

  giteaOwner: string;
  giteaRepo: string;
  giteaRepoUrl: string;
  cloneUrl: string;

  localPath: string;
  defaultBranch: string;
  commitSha?: string;

  downloadedAt: string;
  createdAt?: string;
  updatedAt?: string;
};
```

Store interface:

```ts
export type DownloadedRepositoryStore = {
  ensureSchema(): Promise<void>;

  upsertDownloadedRepository(input: {
    userId: string;
    tomorrowUserId: string;
    tomorrowLogin: string;
    projectName: string;
    projectSlug: string;
    giteaOwner: string;
    giteaRepo: string;
    giteaRepoUrl: string;
    cloneUrl: string;
    localPath: string;
    defaultBranch: string;
    commitSha?: string;
    downloadedAt: string;
  }): Promise<DownloadedRepository>;
};
```

Logical table:

```txt
downloaded_repositories
```

Unique constraint:

```txt
unique(tomorrowUserId, projectSlug)
```

For MVP, an in-memory store is acceptable only if existing project is not ready for DB.

If DATABASE_URL and Postgres helpers exist, use real persistence.

Do NOT store accessToken in this table.

---

# Domain models

Create:

```txt
src/domains/gitea/model/DownloadedRepository.ts
src/domains/gitea/model/GiteaRepository.ts
src/domains/gitea/model/index.ts
```

Do not create large global model files.

---

# SDK responsibilities

Use SDK for generic tools only:

```txt
- loadConfig
- createFastifyApp if available
- createLogger
- AppError / BadRequestError / UnauthorizedError
- createEventBus
- optional database helper if available
```

SDK should NOT contain:

```txt
- Gitea API client
- Git clone logic
- repo path sanitizer
- Tomorrow event business mapping
- Tomorrow connection table business logic
```

Those belong in this usecase-owned shared folder.

---

# Error handling

Use SDK error classes if available.

Map errors:

```txt
invalid event payload -> BadRequestError / AppError 400
missing Tomorrow credentials -> failed[] for all projects
repo not found or access denied -> failed[] item, not whole batch crash
Gitea provider unavailable -> failed[] item or AppError depending on scope
git clone failure -> failed[] item
store failure -> AppError 500
event publish failure -> AppError 502 or eventPublished false depending on existing policy
```

Preferred:

```txt
One failed repo should not stop the whole batch.
Only invalid top-level event payload should stop the whole usecase.
```

Do not leak raw command output if it contains secrets.

Do not leak raw Gitea error responses.

---

# Security rules

Never log, return, publish, or store Tomorrow access token outside the connection table.

Never log, return, publish, or store GITEA_BOT_TOKEN.

Never use GITEA_BOT_TOKEN.

Never publish password.

Do not publish full file contents.

Do not publish raw external API responses.

Do not allow filesystem writes outside GITEA_WORKSPACE_DIR.

Sanitize all path parts.

Scrub token from command errors before throwing.

---

# Tests

Create colocated test:

```txt
downloadGitRepositoryFromTomorrowEvent.test.ts
```

Required tests:

```txt
- validates event version
- validates tomorrowUserId and tomorrowLogin
- validates projects array
- rejects path traversal projectSlug
- loads Tomorrow connection by tomorrowUserId + tomorrowLogin
- if connection missing, all projects fail with "Tomorrow credentials not found for user"
- calls Gitea repo lookup with owner=tomorrowLogin and repo=projectSlug and accessToken from store
- downloads repo using cloneUrl returned by Gitea API
- passes accessToken to downloader but does not return/publish/store token
- stores downloaded repository metadata
- publishes gitea.repositories.downloaded
- failed repo does not stop whole batch
- does not publish Tomorrow access token
- does not publish Gitea bot token
```

Required static checks:

```txt
- no src/controllers folder
- no src/routes folder
- no src/services folder
- no src/repositories folder
- no src/utils folder
- app.ts does not contain git clone command
- app.ts does not contain Gitea fetch call
- app.ts does not contain token SQL query
- no direct kafkajs import in gitea-service
- no GITEA_BOT_TOKEN usage
```

---

# Remove old architecture

Delete or migrate away from:

```txt
src/config/
src/controllers/
src/routes/
src/middlewares/
src/models/
src/repositories/
src/services/
src/utils/
src/validation/
```

Replace with:

```txt
src/app.ts
src/server.ts
src/index.ts
src/domains/gitea/downloadGitRepositoryFromTomorrowEvent/**
src/domains/gitea/model/**
```

Do not keep old big:

```txt
src/services/giteaService.ts
```

Do not keep old:

```txt
src/services/tomorrowProjectDiscoveryClient.ts
```

gitea-service should consume Kafka/Redpanda event from tomorrow-service, not call tomorrow-service directly.

---

# Index exports

Usecase index:

```ts
export * from "./downloadGitRepositoryFromTomorrowEvent";
export * from "./downloadGitRepositoryFromTomorrowEvent.input";
export * from "./downloadGitRepositoryFromTomorrowEvent.output";
export * from "./downloadGitRepositoryFromTomorrowEvent.handler";
```

Usecase shared index may export only helpers needed by app.ts/tests:

```ts
export * from "./createTomorrowConnectionStore";
export * from "./TomorrowConnectionStore";
export * from "./createGiteaRepoLookupClient";
export * from "./GiteaRepoLookupClient";
export * from "./createGitRepositoryDownloader";
export * from "./GitRepositoryDownloader";
export * from "./createDownloadedRepositoryStore";
export * from "./DownloadedRepositoryStore";
export * from "./publishGiteaRepositoriesDownloaded";
export * from "./GiteaRepositoriesDownloadedEvent";
```

Domain index:

```ts
export * from "./downloadGitRepositoryFromTomorrowEvent";
export * from "./model";
```

Root index:

```ts
export * from "./domains/gitea";
```

All index.ts files must be pure barrel exports.

No runtime initialization inside index.ts.

---

# Final output required

After rewriting, output:

```txt
1. Final folder tree
2. Only usecase implemented
3. Files created
4. Files deleted
5. Old folders removed
6. Event consumed
7. Event published
8. Tomorrow credential lookup behavior
9. Gitea lookup behavior
10. Git download/update behavior
11. Store/table used
12. SDK dependencies used
13. TypeScript check result
14. Test result
15. Build result
16. Assumptions made
```

Expected final architecture sentence:

```txt
gitea-service is an event-driven Git repository downloader.
It consumes tomorrow.succeeded_projects.discovered, reads the user's Tomorrow JWT from the local user connection table, uses that user token to access and download matching Gitea repositories, stores local download metadata, and publishes gitea.repositories.downloaded.
No GITEA_BOT_TOKEN, no repository CRUD, no analysis, no Tomorrow API client, and no direct Kafka implementation lives in the usecase.
```

Absolute must follow:

```txt
Do not implement repository CRUD.
Do not implement analysis jobs.
Do not implement bot access usecase separately.
Do not implement safe file reading.
Do not call Tomorrow service.
Do not call LLM.
Do not generate questions.
Do not create global controllers/routes/services/repositories/utils folders.
Do not import kafkajs directly.
Do not leak secrets.
Do not use GITEA_BOT_TOKEN.
Only implement downloadGitRepositoryFromTomorrowEvent.
```
