import { AppError } from "../../errors/AppError.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import type { HttpClient, HttpRequestOptions } from "./HttpClient.js";

type ServiceEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  } | null;
};

type CreateHttpClientInput = {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

type Fetcher = typeof fetch;

export function createHttpClient(input: CreateHttpClientInput, fetcher: Fetcher = fetch): HttpClient {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  const baseHeaders = input.headers ?? {};
  const timeoutMs = input.timeoutMs ?? 5000;

  return {
    get(path, options) {
      return request("GET", path, undefined, options);
    },
    post(path, body, options) {
      return request("POST", path, body, options);
    },
    put(path, body, options) {
      return request("PUT", path, body, options);
    },
    delete(path, options) {
      return request("DELETE", path, undefined, options);
    }
  };

  async function request<T>(method: string, path: string, body?: unknown, options: HttpRequestOptions = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);

    try {
      const response = await fetcher(buildUrl(baseUrl, path, options.searchParams), {
        method,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...baseHeaders,
          ...(options.headers ?? {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal
      });

      const payload = await parsePayload<T>(response);
      if (!response.ok) {
        throw mapResponseError(response.status, payload);
      }

      if (isServiceEnvelope<T>(payload)) {
        if (!payload.success) {
          throw mapEnvelopeError(response.status, payload);
        }

        return payload.data as T;
      }

      return payload as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("HTTP request timed out.", {
          statusCode: 504,
          code: "UPSTREAM_TIMEOUT"
        });
      }

      throw new AppError("HTTP request failed.", {
        statusCode: 502,
        code: "UPSTREAM_UNAVAILABLE"
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function buildUrl(baseUrl: string, path: string, searchParams?: HttpRequestOptions["searchParams"]) {
  const url = new URL(path, `${baseUrl}/`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parsePayload<T>(response: Response) {
  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return (await response.json().catch(() => null)) as T | ServiceEnvelope<T> | null;
}

function isServiceEnvelope<T>(payload: unknown): payload is ServiceEnvelope<T> {
  return Boolean(payload && typeof payload === "object" && ("success" in payload || "error" in payload || "data" in payload));
}

function mapEnvelopeError(status: number, payload: ServiceEnvelope<unknown>) {
  return mapStatusToError(status, payload.error?.message ?? "HTTP request failed.", payload.error?.code ?? "HTTP_ERROR", payload.error?.details);
}

function mapResponseError(status: number, payload: unknown) {
  if (isServiceEnvelope(payload)) {
    return mapEnvelopeError(status, payload);
  }

  return mapStatusToError(status, "HTTP request failed.", "HTTP_ERROR");
}

function mapStatusToError(status: number, message: string, code: string, details?: unknown) {
  switch (status) {
    case 400:
      return new BadRequestError(message, details);
    case 401:
      return new UnauthorizedError(message, details);
    case 403:
      return new ForbiddenError(message, details);
    case 404:
      return new NotFoundError(message, details);
    case 409:
      return new ConflictError(message, details);
    default:
      return new AppError(message, {
        statusCode: status >= 400 ? status : 500,
        code,
        details
      });
  }
}
