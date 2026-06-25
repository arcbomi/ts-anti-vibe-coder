import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE, type ProxyRoute } from "../models/gateway.js";
import type { ApiGatewayRequest, ProxyRequestInput, ProxyRequestResult } from "../types/service.js";
import { buildUpstreamUrl } from "../utils/targetUrl.js";

type ProxyRepositoryOptions = {
  fetchImpl?: typeof fetch;
  upstreams: Record<ProxyRoute["service"], string>;
};

export class ProxyRepository {
  private readonly fetchImpl: typeof fetch;
  private readonly upstreams: Record<ProxyRoute["service"], string>;

  constructor({ fetchImpl = fetch, upstreams }: ProxyRepositoryOptions) {
    this.fetchImpl = fetchImpl;
    this.upstreams = upstreams;
  }

  async forward({ request, route, pathParams }: ProxyRequestInput): Promise<ProxyRequestResult> {
    const upstreamBaseUrl = this.upstreams[route.service];
    const upstreamPath = interpolatePath(route.upstreamPath ?? request.url.split("?")[0] ?? "/", pathParams);
    const queryString = request.url.includes("?") ? request.url.split("?")[1] ?? "" : "";
    const body = shouldIncludeBody(request.method) ? toBodyInit(request.body) : undefined;

    let response: Response;
    try {
      response = await this.fetchImpl(buildUpstreamUrl(upstreamBaseUrl, upstreamPath, queryString), {
        method: request.method,
        headers: buildUpstreamHeaders(request),
        body
      });
    } catch (error) {
      const isTimeout = error instanceof Error && /timeout/i.test(error.message);
      throw new AppError(isTimeout ? "Gateway timeout." : "Upstream service unavailable.", {
        statusCode: isTimeout ? 504 : 502,
        code: isTimeout ? ERROR_CODE.gatewayTimeout : ERROR_CODE.badGateway
      });
    }

    return {
      statusCode: response.status,
      headers: response.headers,
      body: Buffer.from(await response.arrayBuffer())
    };
  }
}

function buildUpstreamHeaders(request: ApiGatewayRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    }
  }

  if (request.headers.host) {
    headers.delete("host");
  }
  if (request.userContext?.userId) {
    headers.set("x-user-id", request.userContext.userId);
  }

  return headers;
}

function shouldIncludeBody(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function toBodyInit(body: unknown): BodyInit | undefined {
  if (body == null) {
    return undefined;
  }
  if (typeof body === "string" || body instanceof URLSearchParams) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  return JSON.stringify(body);
}

function interpolatePath(pathTemplate: string, pathParams: Record<string, string>) {
  return Object.entries(pathParams).reduce(
    (path, [key, value]) => path.replaceAll(`:${key}`, encodeURIComponent(value)),
    pathTemplate
  );
}
