import type { FastifyRequest } from "fastify";
import { readInternalUserContext } from "./readInternalUserContext.js";

export async function attachInternalAuthContext(request: FastifyRequest) {
  const auth = readInternalUserContext(request);
  if (auth) {
    request.auth = auth;
  }
}
