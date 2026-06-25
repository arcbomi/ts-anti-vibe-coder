import type { FastifyInstance } from "fastify";
import type { AuthController } from "../controllers/authController.js";
import type { AuthService } from "../services/authService.js";
import { registerAuthRoutes } from "./authRoutes.js";

export function registerAuthServiceRoutes(
  app: FastifyInstance,
  dependencies: { authController: AuthController; authService: AuthService }
) {
  registerAuthRoutes(app, dependencies);
}
