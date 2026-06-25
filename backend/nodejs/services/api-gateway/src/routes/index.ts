import type { FastifyInstance } from "fastify";
import { GatewayController } from "../controllers/gatewayController.js";
import { requireBearerAuth } from "../middlewares/bearerAuth.js";
import type { JwtValidator } from "../types/service.js";

type RegisterRoutesOptions = {
  gatewayController: GatewayController;
  jwtValidator: JwtValidator;
};

export function registerApiGatewayRoutes(app: FastifyInstance, options: RegisterRoutesOptions) {
  const protectedPreHandler = requireBearerAuth(options.jwtValidator);

  app.get("/healthz", async (request, reply) => options.gatewayController.health(request, reply));

  app.route({
    method: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    url: "/auth/*",
    handler: async (request, reply) => options.gatewayController.handleProxy(request, reply)
  });
  app.route({
    method: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
    url: "/auth",
    handler: async (request, reply) => options.gatewayController.handleProxy(request, reply)
  });

  const protectedRoutes = [
    "/succeeded-projects",
    "/succeeded-projects/*",
    "/repositories",
    "/repositories/*",
    "/analysis-jobs/:id",
    "/analysis-jobs/:id/questions",
    "/exams",
    "/exams/*",
    "/exams/:id/questions"
  ] as const;

  for (const url of protectedRoutes) {
    app.route({
      method: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
      url,
      preHandler: protectedPreHandler,
      handler: async (request, reply) => options.gatewayController.handleProxy(request, reply)
    });
  }
}
