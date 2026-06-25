import type { FastifyReply } from "fastify";
import { sendSuccess } from "../../../../packages/microservice-sdk/src/index.js";
import type { ApiGatewayRequest } from "../types/service.js";
import { GatewayService } from "../services/gatewayService.js";

export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  async health(_: ApiGatewayRequest, reply: FastifyReply) {
    return sendSuccess(reply, { status: "ok" });
  }

  async handleProxy(request: ApiGatewayRequest, reply: FastifyReply) {
    const pathname = request.url.split("?")[0] ?? "/";
    const routeMatch = this.gatewayService.matchRoute(pathname);
    const upstreamResponse = await this.gatewayService.proxyRequest({
      routeMatch,
      request
    });

    for (const [key, value] of upstreamResponse.headers.entries()) {
      if (shouldForwardHeader(key)) {
        reply.header(key, value);
      }
    }

    reply.code(upstreamResponse.statusCode);
    return reply.send(upstreamResponse.body);
  }
}

function shouldForwardHeader(name: string) {
  const header = name.toLowerCase();
  return ![
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-allow-credentials",
    "access-control-expose-headers",
    "access-control-max-age",
    "content-length",
    "transfer-encoding",
    "connection"
  ].includes(header);
}
