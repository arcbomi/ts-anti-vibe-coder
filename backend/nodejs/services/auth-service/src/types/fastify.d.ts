import "fastify";
import type { PublicUser } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: PublicUser;
  }
}
