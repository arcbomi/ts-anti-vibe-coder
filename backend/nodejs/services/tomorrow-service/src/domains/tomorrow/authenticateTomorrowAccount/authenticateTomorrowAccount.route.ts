import type { FastifyInstance } from "fastify";
import { BadRequestError, sendSuccess } from "@backend/microservice-sdk";
import type { AuthenticateTomorrowAccountInput } from "./authenticateTomorrowAccount.input.js";
import type { AuthenticateTomorrowAccountOutput } from "./authenticateTomorrowAccount.output.js";

export async function registerAuthenticateTomorrowAccountRoute(
  app: FastifyInstance,
  deps: {
    authenticateTomorrowAccount: (input: AuthenticateTomorrowAccountInput) => Promise<AuthenticateTomorrowAccountOutput>;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.post("/tomorrow/authenticate", async (request, reply) => {
    if (request.body === null || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new BadRequestError("Invalid Tomorrow authentication request");
    }

    const body = request.body as Partial<AuthenticateTomorrowAccountInput>;

    if (typeof body.login !== "string" || typeof body.password !== "string") {
      throw new BadRequestError("Invalid Tomorrow authentication request");
    }

    const result = await deps.authenticateTomorrowAccount({
      login: body.login,
      password: body.password
    });

    if (deps.sendSuccess) {
      return deps.sendSuccess(reply, result);
    }

    return reply.send(result);
  });
}
