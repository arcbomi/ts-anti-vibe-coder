import type { FastifyInstance } from "fastify";
import type { AuthController } from "../controllers/authController.js";
import type { AuthService } from "../services/authService.js";
import { requireBearerAuth } from "../middlewares/bearerAuth.js";

export function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: { authController: AuthController; authService: AuthService }
) {
  app.post("/auth/login", async (request, reply) => dependencies.authController.login(request, reply));
  app.post("/auth/logout", async (request, reply) => dependencies.authController.logout(request, reply));
  app.get(
    "/auth/me",
    {
      preHandler: requireBearerAuth(dependencies.authService)
    },
    async (request, reply) => dependencies.authController.me(request, reply)
  );
}
