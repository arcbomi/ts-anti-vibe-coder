import { AppError, BadRequestError } from "@backend/microservice-sdk";
import type { GatewayProxyResult } from "./GatewayProxyResult.js";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

const RESPONSE_HEADERS_TO_SKIP = new Set([
  ...HOP_BY_HOP_HEADERS,
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-max-age"
]);

export async function proxyRequest(input: {
  method: string;
  upstreamUrl: string;
  headers: Record<string, unknown>;
  body?: unknown;
  authenticatedUserId?: string;
  fetchImpl?: typeof fetch;
}): Promise<GatewayProxyResult> {
  const fetchImpl = input.fetchImpl ?? fetch;

  let response: Response;

  try {
    response = await fetchImpl(input.upstreamUrl, {
      method: input.method,
      headers: copyRequestHeaders(input.headers, input.authenticatedUserId),
      body: shouldIncludeBody(input.method) ? toBodyInit(input.body) : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isTimeout = /timeout|abort/i.test(message);

    throw new AppError(isTimeout ? "Gateway timeout." : "Upstream service unavailable.", {
      statusCode: isTimeout ? 504 : 502,
      code: isTimeout ? "GATEWAY_TIMEOUT" : "BAD_GATEWAY"
    });
  }

  return {
    statusCode: response.status,
    headers: copyResponseHeaders(response.headers),
    body: Buffer.from(await response.arrayBuffer())
  };
}

function copyRequestHeaders(headers: Record<string, unknown>, authenticatedUserId?: string) {
  const copiedHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      continue;
    }

    if (typeof value === "string") {
      copiedHeaders.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      copiedHeaders.set(key, value.join(","));
    }
  }

  if (authenticatedUserId) {
    copiedHeaders.set("x-authenticated", "true");
    copiedHeaders.set("x-user-id", authenticatedUserId);
  }

  return copiedHeaders;
}

function copyResponseHeaders(headers: Headers): GatewayProxyResult["headers"] {
  const result: GatewayProxyResult["headers"] = {};

  headers.forEach((value, key) => {
    if (!RESPONSE_HEADERS_TO_SKIP.has(key.toLowerCase())) {
      result[key] = value;
    }
  });

  return result;
}

function shouldIncludeBody(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function toBodyInit(body: unknown): BodyInit | undefined {
  if (body == null) {
    return undefined;
  }
  if (typeof body === "string" || body instanceof URLSearchParams || body instanceof FormData) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body) as unknown as BodyInit;
  }
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as BodyInit;
  }
  if (body instanceof ReadableStream) {
    return body;
  }
  if (typeof body === "object") {
    return JSON.stringify(body);
  }

  throw new BadRequestError("Unsupported request body.");
}
