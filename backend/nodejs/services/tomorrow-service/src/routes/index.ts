import type { FastifyInstance } from "fastify";
import { registerTomorrowRoutes } from "./tomorrowRoutes.js";
import type { TomorrowController } from "../controllers/tomorrowController.js";

export function registerTomorrowServiceRoutes(
  app: FastifyInstance,
  dependencies: { tomorrowController: TomorrowController }
) {
  registerTomorrowRoutes(app, dependencies);
}
