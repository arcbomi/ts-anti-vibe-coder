import type { FastifyInstance } from "fastify";
import type { GiteaController } from "../controllers/giteaController.js";
import type { AuthenticatedRequest } from "../types/service.js";
import { registerGiteaRoutes } from "./giteaRoutes.js";

export function registerGiteaServiceRoutes(
  app: FastifyInstance,
  input: {
    controller: GiteaController;
    requireAuth: (request: AuthenticatedRequest) => Promise<void>;
  }
) {
  registerGiteaRoutes(app, input);
}
