import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { ApiGatewayRequest, RouteMatchResult, UpstreamProxy } from "../types/service.js";
import { matchProxyRoute } from "../validation/routeValidation.js";

export class GatewayService {
  constructor(private readonly upstreamProxy: UpstreamProxy) {}

  matchRoute(pathname: string): RouteMatchResult | null {
    return matchProxyRoute(pathname);
  }

  async proxyRequest(input: {
    routeMatch: RouteMatchResult | null;
    request: ApiGatewayRequest;
  }) {
    const { routeMatch, request } = input;
    if (!routeMatch) {
      throw new AppError("Route not found.", {
        statusCode: 404,
        code: "NOT_FOUND"
      });
    }

    return this.upstreamProxy.forward({
      request,
      route: routeMatch.route,
      pathParams: routeMatch.pathParams
    });
  }
}
