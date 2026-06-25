import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { AuthServiceConfig, ExternalIdentity, TomorrowSchoolGraphQlResponse } from "../types/auth.js";
import {
  buildTomorrowSchoolAuthHeaders,
  buildTomorrowSchoolIdentity,
  extractTomorrowSchoolToken,
  isTomorrowSchoolInvalidCredentials,
  parseTomorrowSchoolJwtClaims
} from "../utils/tomorrowSchool.js";

type Fetcher = typeof fetch;

export class TomorrowSchoolAuthService {
  config: AuthServiceConfig["tomorrowSchool"];
  fetcher: Fetcher;

  constructor(config: AuthServiceConfig["tomorrowSchool"], fetcher: Fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  async authenticate(credential: string, password: string): Promise<ExternalIdentity> {
    if (!this.config.endpoint) {
      throw new AppError("Authentication provider is unavailable.", {
        statusCode: 502,
        code: "AUTH_PROVIDER_UNAVAILABLE"
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetcher(this.config.endpoint, {
        method: "POST",
        headers: buildTomorrowSchoolAuthHeaders({
          credential,
          password,
          referrer: this.config.referrer,
          xJwtToken: this.config.xJwtToken,
          sessionId: this.config.sessionId
        }),
        signal: controller.signal
      });

      const rawBody = await response.text();
      const parsed = extractTomorrowSchoolToken(rawBody);

      if (isTomorrowSchoolInvalidCredentials(response.status, parsed.responseError)) {
        throw new AppError("Invalid email or password.", {
          statusCode: 401,
          code: "INVALID_CREDENTIALS"
        });
      }

      if (!response.ok || !parsed.token) {
        throw new AppError("Authentication provider is unavailable.", {
          statusCode: 502,
          code: "AUTH_PROVIDER_UNAVAILABLE"
        });
      }

      const claims = parseTomorrowSchoolJwtClaims(parsed.token);
      const profile = await this.fetchProfile(parsed.token, String(claims.sub ?? "").trim());

      return buildTomorrowSchoolIdentity({
        credential,
        token: parsed.token,
        claims,
        user: parsed.user,
        profile: profile ?? undefined,
        profilePath: this.config.profilePath
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Authentication provider timed out.", {
          statusCode: 504,
          code: "AUTH_PROVIDER_TIMEOUT"
        });
      }

      throw new AppError("Authentication provider is unavailable.", {
        statusCode: 502,
        code: "AUTH_PROVIDER_UNAVAILABLE",
        cause: error
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchProfile(token: string, subject: string) {
    if (!this.config.graphQlEndpoint || !subject) {
      return null;
    }

    const userId = Number(subject);
    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const response = await this.fetcher(this.toHttpGraphQlEndpoint(this.config.graphQlEndpoint), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Hasura-Role": this.config.graphQlRole || "user"
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

    const payload = (await response.json()) as TomorrowSchoolGraphQlResponse;
    if (payload.errors?.length || !payload.data?.user) {
      return null;
    }

    return {
      login: String(payload.data.user.login ?? "").trim(),
      email: String(payload.data.user.email ?? "").trim(),
      firstName: String(payload.data.user.firstName ?? "").trim(),
      lastName: String(payload.data.user.lastName ?? "").trim()
    };
  }

  private toHttpGraphQlEndpoint(endpoint: string) {
    if (endpoint.startsWith("ws://")) {
      return `http://${endpoint.slice(5)}`;
    }
    if (endpoint.startsWith("wss://")) {
      return `https://${endpoint.slice(6)}`;
    }
    return endpoint;
  }
}
