import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { buildProject } from "../models/project.js";
import { buildSession } from "../models/session.js";
import { extractAuthToken, extractUserIdFromJwt, toBasicAuthorization } from "../utils/auth.js";
import { firstNonEmpty, normalizeProjectPath, normalizeUrl, pathBase, slugify } from "../utils/string.js";
import { parseProjectsFromProfileHtml } from "../utils/htmlProjectParser.js";
import type { GraphqlPayload, TomorrowProject, TomorrowServiceConfig, TomorrowSession } from "../types/tomorrow.js";

const SUCCEEDED_STATUS = "Project succeeded";
const INVALID_CREDENTIALS_MESSAGE = "User does not exist or password incorrect";
const DEFAULT_EVENT_ID = 96;
const SUCCEEDED_PROJECTS_QUERY = `
query SucceededProjects($userId: Int!, $eventId: Int!) {
  progress(where: {userId: {_eq: $userId}, isDone: {_eq: true}}) {
    grade
    path
    object {
      name
      type
    }
  }
  groups: group(
    where: {
      members: {userId: {_eq: $userId}}
      _or: [
        {eventId: {_eq: $eventId}}
        {event: {parentId: {_eq: $eventId}}}
      ]
    }
    order_by: {updatedAt: desc}
  ) {
    path
    captainLogin
    members(where: {userId: {_eq: $userId}}) {
      userId
      accepted
    }
    event {
      path
    }
  }
}`;

type Fetcher = typeof fetch;

export class TomorrowRepository {
  config: TomorrowServiceConfig;
  fetcher: Fetcher;

  constructor(config: TomorrowServiceConfig, fetcher: Fetcher = fetch) {
    this.config = {
      ...config,
      baseUrl: normalizeUrl(config.baseUrl)
    };
    this.fetcher = fetcher;
  }

  async login({ username, password }: { username: string; password: string }): Promise<TomorrowSession> {
    const response = await this.fetcher(this.resolveAuthEndpoint(), {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Authorization: toBasicAuthorization(username, password),
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "X-Jwt-Token": firstNonEmpty(this.config.xJwtToken, "undefined"),
        ...(this.config.sessionId ? { "X-Session-Id": this.config.sessionId } : {}),
        ...(this.resolveReferrer() ? { Referer: this.resolveReferrer() } : {})
      }
    });

    const rawBody = await response.text();
    const { token, responseError } = extractAuthToken(rawBody);

    if ([401, 403].includes(response.status) || responseError === INVALID_CREDENTIALS_MESSAGE) {
      throw new AppError("Tomorrow login failed: invalid credentials", {
        statusCode: 401,
        code: "TOMORROW_LOGIN_FAILED"
      });
    }

    if (!response.ok) {
      throw new AppError(`Tomorrow login failed with status ${response.status}`, {
        statusCode: 502,
        code: "TOMORROW_LOGIN_FAILED"
      });
    }

    if (!token) {
      throw new AppError("Tomorrow login failed: missing JWT token", {
        statusCode: 502,
        code: "TOMORROW_LOGIN_FAILED"
      });
    }

    return buildSession({
      jwt: token,
      cookies: response.headers.getSetCookie?.() ?? []
    });
  }

  async fetchSucceededProjects({
    session,
    username,
    profilePath
  }: {
    session: TomorrowSession;
    username: string;
    profilePath?: string;
  }): Promise<TomorrowProject[]> {
    try {
      return await this.fetchSucceededProjectsViaGraphql({ session, username });
    } catch {
      const profileHtml = await this.fetchProfilePage({ session, profilePath });
      const projects = parseProjectsFromProfileHtml({
        profileHtml,
        baseUrl: this.config.baseUrl,
        username
      });

      return projects.filter((project) => project.isSucceeded);
    }
  }

  async fetchSucceededProjectsViaGraphql({
    session,
    username
  }: {
    session: TomorrowSession;
    username: string;
  }): Promise<TomorrowProject[]> {
    const userId = extractUserIdFromJwt(session.jwt);
    const response = await this.fetcher(`${this.config.baseUrl}/api/graphql-engine/v1/graphql`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.jwt}`
      },
      body: JSON.stringify({
        query: SUCCEEDED_PROJECTS_QUERY,
        variables: {
          userId,
          eventId: DEFAULT_EVENT_ID
        }
      })
    });

    const payload = (await response.json()) as GraphqlPayload;
    if (!response.ok) {
      throw new AppError(`Tomorrow project discovery failed with status ${response.status}`, {
        statusCode: 502,
        code: "TOMORROW_PROJECT_DISCOVERY_FAILED"
      });
    }

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new AppError(payload.errors[0].message || "Tomorrow GraphQL error", {
        statusCode: 502,
        code: "TOMORROW_PROJECT_DISCOVERY_FAILED"
      });
    }

    const ownerByPath = new Map<string, { owner: string; acceptanceScore: number }>();
    for (const group of payload.data?.groups ?? []) {
      const owner = group?.captainLogin?.trim();
      if (!owner) {
        continue;
      }

      const acceptedValue = group?.members?.[0]?.accepted;
      const acceptanceScore = acceptedValue === true ? 2 : acceptedValue === false ? 1 : 0;

      for (const pathValue of [group?.path, group?.event?.path]) {
        const normalizedPath = normalizeProjectPath(pathValue);
        if (!normalizedPath) {
          continue;
        }

        const current = ownerByPath.get(normalizedPath);
        if (!current || acceptanceScore > current.acceptanceScore) {
          ownerByPath.set(normalizedPath, {
            owner,
            acceptanceScore
          });
        }
      }
    }

    const seen = new Set<string>();
    const projects: TomorrowProject[] = [];
    for (const progress of payload.data?.progress ?? []) {
      if ((progress?.object?.type ?? "").trim().toLowerCase() !== "project") {
        continue;
      }

      const name = (progress?.object?.name ?? "").trim();
      let slug = slugify(name);
      if (!slug) {
        slug = slugify(pathBase(progress?.path ?? ""));
      }
      if (!slug || seen.has(slug)) {
        continue;
      }

      seen.add(slug);
      const repositoryOwner = ownerByPath.get(normalizeProjectPath(progress?.path ?? ""))?.owner ?? username;
      projects.push(
        buildProject({
          id: slug,
          slug,
          name: firstNonEmpty(name, slug),
          repoUrl: `${this.config.baseUrl}/git/${repositoryOwner}/${slug}`,
          status: SUCCEEDED_STATUS,
          auditText: "",
          isSucceeded: true
        })
      );
    }

    return projects;
  }

  async fetchProfilePage({
    session,
    profilePath
  }: {
    session: TomorrowSession;
    profilePath?: string;
  }) {
    const response = await this.fetcher(this.resolveProfileUrl(profilePath), {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Authorization: `Bearer ${session.jwt}`,
        Referer: `${this.config.baseUrl}/`,
        Cookie: this.buildCookieHeader(session)
      }
    });

    const profileHtml = await response.text();
    if (!response.ok) {
      throw new AppError(`Tomorrow profile fetch failed with status ${response.status}`, {
        statusCode: 502,
        code: "TOMORROW_PROFILE_FETCH_FAILED"
      });
    }

    if (!profileHtml.toLowerCase().includes("<html")) {
      throw new AppError("Tomorrow profile fetch failed: expected HTML document", {
        statusCode: 502,
        code: "TOMORROW_PROFILE_FETCH_FAILED"
      });
    }

    return profileHtml;
  }

  buildCookieHeader(session: TomorrowSession) {
    if (Array.isArray(session.cookies) && session.cookies.length > 0) {
      return session.cookies
        .map((cookie) => cookie.split(";")[0].trim())
        .filter(Boolean)
        .join("; ");
    }

    return [`token=${session.jwt}`, `jwt=${session.jwt}`].join("; ");
  }

  resolveAuthEndpoint() {
    return this.config.authEndpoint || `${this.config.baseUrl}/api/auth/signin`;
  }

  resolveReferrer() {
    return this.config.referrer || `${this.config.baseUrl}/?show-password=1`;
  }

  resolveProfileUrl(profilePath?: string) {
    const value = profilePath || this.config.profilePath;
    if (!value.startsWith("http://") && !value.startsWith("https://")) {
      return new URL(value, this.config.baseUrl).toString();
    }

    return value;
  }
}
