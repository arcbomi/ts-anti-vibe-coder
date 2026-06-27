import type { GatewayRoute } from "./GatewayRoute.js";

export type MatchedGatewayRoute = {
  params: Record<string, string>;
  route: GatewayRoute;
  upstreamUrl: string;
};

export function matchGatewayRoute(input: {
  method: string;
  url: string;
  routes: GatewayRoute[];
}): MatchedGatewayRoute | null {
  const requestUrl = new URL(input.url, "http://gateway.local");
  const method = input.method.toUpperCase();

  for (const route of input.routes) {
    if (route.method && route.method.toUpperCase() !== method) {
      continue;
    }

    const params = matchPath(route.path, requestUrl.pathname);
    if (!params) {
      continue;
    }

    const upstreamPath = interpolatePath(route.upstreamPath ?? route.path, params);
    const upstreamUrl = new URL(joinUrlPath(route.upstreamBaseUrl, upstreamPath));
    upstreamUrl.search = requestUrl.search;

    return {
      params,
      route,
      upstreamUrl: upstreamUrl.toString()
    };
  }

  return null;
}

function matchPath(routePath: string, requestPath: string) {
  const routeSegments = splitPath(routePath);
  const requestSegments = splitPath(requestPath);

  if (routeSegments.length !== requestSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const requestSegment = requestSegments[index];

    if (!routeSegment || !requestSegment) {
      return null;
    }

    if (routeSegment.startsWith(":")) {
      params[routeSegment.slice(1)] = decodeURIComponent(requestSegment);
      continue;
    }

    if (routeSegment !== requestSegment) {
      return null;
    }
  }

  return params;
}

function splitPath(path: string) {
  return path.split("/").filter(Boolean);
}

function interpolatePath(pathTemplate: string, params: Record<string, string>) {
  return Object.entries(params).reduce((path, [key, value]) => path.replaceAll(`:${key}`, encodeURIComponent(value)), pathTemplate);
}

function joinUrlPath(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
