import type { FastifyInstance } from "fastify";
import type { StatusController } from "../controllers/statusController.js";
import type { UserController } from "../controllers/userController.js";
import { requireInternalToken } from "../middlewares/internalAuth.js";
import type { UserServiceConfig } from "../types/service.js";

interface RegisterUserServiceRoutesOptions {
  statusController: StatusController;
  userController: UserController;
  config: UserServiceConfig;
}

export function registerUserServiceRoutes(
  app: FastifyInstance,
  { statusController, userController, config }: RegisterUserServiceRoutesOptions
): void {
  app.get("/api/v1/status", async (request, reply) => statusController.status(request, reply));
  app.get("/api/v1/health", async (request, reply) => statusController.status(request, reply));

  app.register(
    (internalApp, _options, done) => {
      internalApp.addHook("preHandler", async (request) => requireInternalToken(request, config));

      internalApp.post("/users", async (request, reply) => userController.createUser(request, reply));
      internalApp.put("/users/external", async (request, reply) => userController.upsertExternalUser(request, reply));
      internalApp.put("/users/dev-seed", async (request, reply) => userController.updateUserForDevSeed(request, reply));
      internalApp.get("/users/by-email", async (request, reply) => userController.getUserByEmail(request, reply));
      internalApp.get("/users/by-id", async (request, reply) => userController.getUserById(request, reply));
      internalApp.get("/users/by-username", async (request, reply) => userController.getUserByUsername(request, reply));
      internalApp.get("/users/exists", async (request, reply) => userController.exists(request, reply));
      internalApp.get("/users/:id/public", async (request, reply) => userController.getPublicUserById(request, reply));
      internalApp.patch("/users/:id/profile", async (request, reply) => userController.updateProfile(request, reply));

      done();
    },
    { prefix: "/internal" }
  );
}
