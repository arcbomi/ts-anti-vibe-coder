import type { FastifyInstance } from "fastify";
import {
  AppError,
  createEventBus,
  createFastifyApp,
  createLogger,
  loadConfig,
  readBearerToken,
  sendSuccess
} from "@backend/microservice-sdk";
import { createAuthenticateTomorrowAccount, registerAuthenticateTomorrowAccountRoute } from "./domains/tomorrow/authenticateTomorrowAccount/index.js";
import { createGetTomorrowUserInformation, registerGetTomorrowUserInformationRoute } from "./domains/tomorrow/getTomorrowUserInformation/index.js";
import {
  createSyncSucceededProjectRepos,
  registerSyncSucceededProjectReposRoute
} from "./domains/tomorrow/syncSucceededProjectRepos/index.js";
import { createTomorrowProjectRepoStore } from "./domains/tomorrow/model/TomorrowProjectRepo.js";

type TomorrowServiceAppConfig = ReturnType<typeof loadConfig> & {
  giteaBaseUrl: string;
};

export type TomorrowServiceApp = FastifyInstance & {
  config: TomorrowServiceAppConfig;
  serviceLogger?: ReturnType<typeof createLogger>;
};

export async function buildApp(): Promise<TomorrowServiceApp> {
  const config = loadConfig("tomorrow-service");
  const giteaBaseUrl = readRequiredEnv("GITEA_BASE_URL", `${String(config.tomorrowSchoolBaseUrl ?? "").replace(/\/+$/, "")}/git`);
  const logger = createLogger({ serviceName: config.serviceName, logLevel: config.logLevel });
  const eventBus = createEventBus(config);
  const tomorrowProjectRepoStore = createTomorrowProjectRepoStore("in-memory");

  await tomorrowProjectRepoStore.ensureSchema();

  const tomorrowClient = createTomorrowClient({
    baseUrl: config.tomorrowSchoolBaseUrl ?? "",
    authEndpoint: config.tomorrowSchoolAuthEndpoint ?? "",
    timeoutMs: config.tomorrowSchoolTimeoutMs ?? 10_000,
    referrer: config.tomorrowSchoolReferrer,
    xJwtToken: config.tomorrowSchoolXJwtToken,
    sessionId: config.tomorrowSchoolSessionId,
    graphQlEndpoint: config.tomorrowSchoolGraphQlEndpoint ?? `${String(config.tomorrowSchoolBaseUrl ?? "").replace(/\/+$/, "")}/api/graphql-engine/v1/graphql`,
    graphQlRole: config.tomorrowSchoolGraphQlRole ?? "user"
  });

  const giteaClient = createGiteaClient({
    baseUrl: giteaBaseUrl
  });

  const authenticateTomorrowAccount = createAuthenticateTomorrowAccount({
    tomorrowClient
  });

  const getTomorrowUserInformation = createGetTomorrowUserInformation({
    tomorrowClient
  });

  const syncSucceededProjectRepos = createSyncSucceededProjectRepos({
    tomorrowClient,
    giteaClient,
    tomorrowProjectRepoStore,
    eventBus
  });

  const app = createFastifyApp({
    serviceName: config.serviceName,
    appEnv: config.appEnv,
    logger,
    registerRoutes(fastify) {
      registerAuthenticateTomorrowAccountRoute(fastify, {
        authenticateTomorrowAccount,
        sendSuccess
      });
      registerGetTomorrowUserInformationRoute(fastify, {
        getTomorrowUserInformation,
        getBearerToken: readBearerToken,
        sendSuccess
      });
      registerSyncSucceededProjectReposRoute(fastify, {
        syncSucceededProjectRepos,
        getBearerToken: readBearerToken,
        sendSuccess
      });
    }
  }) as unknown as TomorrowServiceApp;

  app.decorate("config", {
    ...config,
    giteaBaseUrl
  });

  return app;
}

function readRequiredEnv(name: string, fallback = "") {
  const value = String(process.env[name] ?? fallback).trim();
  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return value;
}

function createTomorrowClient(config: {
  baseUrl: string;
  authEndpoint: string;
  timeoutMs: number;
  referrer?: string;
  xJwtToken?: string;
  sessionId?: string;
  graphQlEndpoint: string;
  graphQlRole: string;
}) {
  return {
    async authenticate(input: { login: string; password: string }) {
      const response = await fetch(config.authEndpoint, {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "X-Jwt-Token": config.xJwtToken || "undefined",
          ...(config.sessionId ? { "X-Session-Id": config.sessionId } : {}),
          ...(config.referrer ? { Referer: config.referrer } : {})
        },
        signal: AbortSignal.timeout(config.timeoutMs)
      });

      const rawBody = await response.text();
      const token = extractAccessToken(rawBody);

      if ([401, 403].includes(response.status)) {
        throw new AppError("Invalid Tomorrow credentials", {
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      if (!response.ok || !token) {
        throw new AppError("Tomorrow authentication provider is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_AUTH_PROVIDER_UNAVAILABLE"
        });
      }

      return {
        accessToken: token
      };
    },

    async getCurrentUser(input: { accessToken: string }) {
      const subject = readJwtSubject(input.accessToken);
      if (!subject) {
        throw new AppError("Invalid Tomorrow access token.", {
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      const response = await fetch(config.graphQlEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.accessToken}`,
          "X-Hasura-Role": config.graphQlRole
        },
        body: JSON.stringify({
          query: `
query CurrentUser($userId: Int!) {
  user: user_by_pk(id: $userId) {
    login
    email
    firstName
    lastName
  }
}`,
          variables: {
            userId: Number(subject)
          }
        }),
        signal: AbortSignal.timeout(config.timeoutMs)
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: {
          user?: {
            login?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
          } | null;
        };
        errors?: Array<{ message?: string }>;
      } | null;

      if (response.status === 401 || response.status === 403) {
        throw new AppError("Invalid Tomorrow access token.", {
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      if (!response.ok || payload?.errors?.length) {
        throw new AppError("Tomorrow user information is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_USER_LOOKUP_FAILED"
        });
      }

      const user = payload?.data?.user;
      if (!user?.login) {
        throw new AppError("Tomorrow user information is unavailable.", {
          statusCode: 502,
          code: "TOMORROW_USER_LOOKUP_FAILED"
        });
      }

      return {
        id: String(subject),
        login: user.login,
        email: user.email,
        displayName: joinName(user.firstName, user.lastName)
      };
    },

    async listProjects(input: { accessToken: string; tomorrowUserId: string }) {
      const userId = Number(input.tomorrowUserId);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new AppError("Tomorrow user id must be numeric.", {
          statusCode: 400,
          code: "BAD_REQUEST"
        });
      }

      const response = await fetch(config.graphQlEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.accessToken}`,
          "X-Hasura-Role": config.graphQlRole
        },
        body: JSON.stringify({
          query: `
query SucceededProjects($userId: Int!) {
  progress(where: {userId: {_eq: $userId}, isDone: {_eq: true}}) {
    path
    object {
      name
      type
    }
  }
}`,
          variables: {
            userId
          }
        }),
        signal: AbortSignal.timeout(config.timeoutMs)
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: {
          progress?: Array<{
            path?: string;
            object?: {
              name?: string;
              type?: string;
            } | null;
          }>;
        };
        errors?: Array<{ message?: string }>;
      } | null;

      if (response.status === 401 || response.status === 403) {
        throw new AppError("Invalid Tomorrow access token.", {
          statusCode: 401,
          code: "UNAUTHORIZED"
        });
      }

      if (!response.ok || payload?.errors?.length) {
        throw new AppError("Tomorrow project discovery failed.", {
          statusCode: 502,
          code: "TOMORROW_SYNC_FAILED"
        });
      }

      const seen = new Set<string>();
      const projects = [];
      for (const progress of payload?.data?.progress ?? []) {
        if ((progress.object?.type ?? "").trim().toLowerCase() !== "project") {
          continue;
        }

        const name = (progress.object?.name ?? "").trim();
        const slug = normalizeSlug(name || progress.path || "");
        if (!name || !slug || seen.has(slug)) {
          continue;
        }

        seen.add(slug);
        projects.push({
          id: slug,
          name,
          slug,
          status: "succeeded" as const
        });
      }

      return projects;
    }
  };
}

function createGiteaClient(config: { baseUrl: string }) {
  return {
    async listUserRepos(input: { username: string }) {
      const repos = [];
      let page = 1;

      while (true) {
        const response = await fetch(
          `${config.baseUrl.replace(/\/+$/g, "")}/api/v1/users/${encodeURIComponent(input.username)}/repos?limit=100&page=${page}`,
          {
            headers: {
              Accept: "application/json"
            }
          }
        );

        if (!response.ok) {
          throw new AppError("Unable to read Gitea repositories.", {
            statusCode: 502,
            code: "GITEA_API_ERROR"
          });
        }

        const payload = (await response.json().catch(() => [])) as Array<{
          id?: number | string;
          name?: string;
          full_name?: string;
          html_url?: string;
          clone_url?: string;
          ssh_url?: string;
          owner?: {
            login?: string;
            username?: string;
          };
        }>;

        for (const repo of payload) {
          if (!repo?.name || !repo?.html_url) {
            continue;
          }

          repos.push({
            id: String(repo.id ?? repo.full_name ?? repo.name),
            name: repo.name,
            owner: String(repo.owner?.login ?? repo.owner?.username ?? input.username),
            url: repo.html_url,
            cloneUrl: repo.clone_url,
            sshUrl: repo.ssh_url
          });
        }

        if (payload.length < 100) {
          break;
        }

        page += 1;
      }

      return repos;
    }
  };
}

function extractAccessToken(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return String(JSON.parse(trimmed)).trim();
    } catch {
      return trimmed.slice(1, -1).trim();
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as { token?: string; accessToken?: string; data?: { token?: string; accessToken?: string } };
    return String(parsed.token ?? parsed.accessToken ?? parsed.data?.token ?? parsed.data?.accessToken ?? "").trim();
  } catch {
    return trimmed;
  }
}

function readJwtSubject(token: string) {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length < 2) {
    return "";
  }

  try {
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed = JSON.parse(payload) as { sub?: string | number };
    return String(parsed.sub ?? "").trim();
  } catch {
    return "";
  }
}

function joinName(firstName?: string, lastName?: string) {
  return [firstName, lastName].map((value) => String(value ?? "").trim()).filter(Boolean).join(" ").trim() || undefined;
}

function normalizeSlug(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
