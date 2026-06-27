import type { AppConfig } from "../../config/AppConfig.js";
import { AppError } from "../../errors/AppError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import type { TomorrowSchoolAuthClient } from "./TomorrowSchoolAuthClient.js";

type Fetcher = typeof fetch;
type GraphQlResponse = {
  data?: {
    user?: {
      login?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
  };
  errors?: Array<{
    message?: string;
  }>;
};

const INVALID_CREDENTIALS_MESSAGE = "User does not exist or password incorrect";

export function createTomorrowSchoolAuthClient(
  config: Pick<
    AppConfig,
    | "tomorrowSchoolAuthEndpoint"
    | "tomorrowSchoolTimeoutMs"
    | "tomorrowSchoolReferrer"
    | "tomorrowSchoolXJwtToken"
    | "tomorrowSchoolSessionId"
    | "tomorrowSchoolGraphQlEndpoint"
    | "tomorrowSchoolGraphQlRole"
    | "tomorrowSchoolProfilePath"
  >,
  fetcher: Fetcher = fetch
): TomorrowSchoolAuthClient {
  return {
    async login(input) {
      const endpoint = config.tomorrowSchoolAuthEndpoint?.trim();
      if (!endpoint) {
        throw new AppError("Tomorrow School auth endpoint is unavailable.", {
          statusCode: 502,
          code: "AUTH_PROVIDER_UNAVAILABLE"
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.tomorrowSchoolTimeoutMs ?? 10000);

      try {
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: buildAuthHeaders({
            login: input.login,
            password: input.password,
            referrer: config.tomorrowSchoolReferrer,
            xJwtToken: config.tomorrowSchoolXJwtToken,
            sessionId: config.tomorrowSchoolSessionId
          }),
          signal: controller.signal
        });

        const rawBody = await response.text();
        const parsed = extractToken(rawBody);

        if (isInvalidCredentials(response.status, parsed.responseError)) {
          throw new UnauthorizedError("Invalid email or password.");
        }

        if (!response.ok || !parsed.token) {
          throw new AppError("Tomorrow School auth provider is unavailable.", {
            statusCode: 502,
            code: "AUTH_PROVIDER_UNAVAILABLE"
          });
        }

        const claims = parseJwtClaims(parsed.token);
        const profile = await fetchProfile({
          token: parsed.token,
          subject: String(claims.sub ?? "").trim(),
          graphQlEndpoint: config.tomorrowSchoolGraphQlEndpoint,
          graphQlRole: config.tomorrowSchoolGraphQlRole,
          fetcher
        });

        const login = firstNonEmpty(profile?.login ?? "", toString(parsed.user?.username), input.login);
        const email = firstNonEmpty(profile?.email ?? "", toString(parsed.user?.email), toString(claims.email));
        const displayName = firstNonEmpty(
          joinName(profile?.firstName ?? "", profile?.lastName ?? ""),
          toString(parsed.user?.full_name),
          toString(parsed.user?.name),
          toString(claims.name),
          login
        );

        return {
          externalId: String(claims.sub ?? login).trim(),
          login,
          email: email || undefined,
          displayName: displayName || undefined
        };
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new AppError("Tomorrow School auth provider timed out.", {
            statusCode: 504,
            code: "AUTH_PROVIDER_TIMEOUT"
          });
        }

        throw new AppError("Tomorrow School auth provider is unavailable.", {
          statusCode: 502,
          code: "AUTH_PROVIDER_UNAVAILABLE"
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }
  };
}

function buildAuthHeaders(input: {
  login: string;
  password: string;
  referrer?: string;
  xJwtToken?: string;
  sessionId?: string;
}) {
  return {
    Accept: "*/*",
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Jwt-Token": input.xJwtToken || "undefined",
    ...(input.sessionId ? { "X-Session-Id": input.sessionId } : {}),
    ...(input.referrer ? { Referer: input.referrer } : {})
  };
}

async function fetchProfile(input: {
  token: string;
  subject: string;
  graphQlEndpoint?: string;
  graphQlRole?: string;
  fetcher: Fetcher;
}) {
  if (!input.graphQlEndpoint || !input.subject) {
    return null;
  }

  const userId = Number(input.subject);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const response = await input.fetcher(toHttpUrl(input.graphQlEndpoint), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.token}`,
      "X-Hasura-Role": input.graphQlRole || "user"
    },
    body: JSON.stringify({
      query: `
query UserById($userId: Int!) {
  user: user_by_pk(id: $userId) {
    login
    email
    firstName
    lastName
  }
}`,
      variables: {
        userId
      }
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as GraphQlResponse | null;
  if (!payload?.data?.user || payload.errors?.length) {
    return null;
  }

  return {
    login: firstNonEmpty(payload.data.user.login ?? ""),
    email: firstNonEmpty(payload.data.user.email ?? ""),
    firstName: firstNonEmpty(payload.data.user.firstName ?? ""),
    lastName: firstNonEmpty(payload.data.user.lastName ?? "")
  };
}

function toHttpUrl(endpoint: string) {
  if (endpoint.startsWith("ws://")) {
    return `http://${endpoint.slice(5)}`;
  }
  if (endpoint.startsWith("wss://")) {
    return `https://${endpoint.slice(6)}`;
  }
  return endpoint;
}

function extractToken(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return { token: "", responseError: "" };
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return {
        token: String(JSON.parse(trimmed)).trim(),
        responseError: ""
      };
    } catch {
      return { token: "", responseError: "" };
    }
  }

  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      token: String(payload.jwt ?? payload.access_token ?? payload.token ?? "").trim(),
      responseError: String(payload.error ?? "").trim(),
      user: payload.user as Record<string, unknown> | undefined
    };
  } catch {
    return { token: "", responseError: "" };
  }
}

function parseJwtClaims(token: string) {
  const payload = token.split(".")[1];
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isInvalidCredentials(status: number, responseError: string) {
  return status === 401 || status === 403 || responseError.trim() === INVALID_CREDENTIALS_MESSAGE;
}

function toString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function joinName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
