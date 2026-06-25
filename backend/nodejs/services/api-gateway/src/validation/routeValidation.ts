import type { ProxyRoute } from "../models/gateway.js";
import type { RouteMatchResult } from "../types/service.js";

type RouteDefinition = {
  pattern: RegExp;
  route: ProxyRoute;
  mapMatch?(match: RegExpMatchArray): Record<string, string>;
};

const routeDefinitions: RouteDefinition[] = [
  {
    pattern: /^\/auth(?:\/.*)?$/,
    route: { service: "auth" }
  },
  {
    pattern: /^\/succeeded-projects(?:\/.*)?$/,
    route: { service: "exam" }
  },
  {
    pattern: /^\/repositories(?:\/.*)?$/,
    route: { service: "gitea" }
  },
  {
    pattern: /^\/analysis-jobs\/([^/]+)\/questions$/,
    route: { service: "question", upstreamPath: "/analysis-jobs/:id/questions" },
    mapMatch: ([, id]) => ({ id })
  },
  {
    pattern: /^\/analysis-jobs\/([^/]+)$/,
    route: { service: "gitea", upstreamPath: "/analysis-jobs/:id" },
    mapMatch: ([, id]) => ({ id })
  },
  {
    pattern: /^\/exams\/([^/]+)\/questions$/,
    route: { service: "question", upstreamPath: "/exams/:id/questions" },
    mapMatch: ([, id]) => ({ id })
  },
  {
    pattern: /^\/exams(?:\/.*)?$/,
    route: { service: "exam" }
  }
];

export function matchProxyRoute(pathname: string): RouteMatchResult | null {
  for (const definition of routeDefinitions) {
    const match = pathname.match(definition.pattern);
    if (!match) {
      continue;
    }

    return {
      route: definition.route,
      pathParams: definition.mapMatch ? definition.mapMatch(match) : {}
    };
  }

  return null;
}
