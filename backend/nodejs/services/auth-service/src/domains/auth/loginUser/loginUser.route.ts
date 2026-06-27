import { BadRequestError, sendSuccess } from "@backend/microservice-sdk";
import type { FastifyInstance } from "fastify";
import { toHttpCurrentUser } from "../model/CurrentUser.js";
import type { LoginUserInput } from "./loginUser.input.js";
import type { LoginUserOutput } from "./loginUser.output.js";

export function registerLoginUserRoute(
  app: FastifyInstance,
  dependencies: {
    loginUser: (input: LoginUserInput) => Promise<LoginUserOutput>;
    sendSuccess?: typeof sendSuccess;
  }
) {
  app.post("/auth/login", async (request, reply) => {
    const input = parseLoginUserRequest(request.body);
    const result = await dependencies.loginUser(input);
    const payload = {
      access_token: result.accessToken,
      user: toHttpCurrentUser(result.user)
    };

    if (dependencies.sendSuccess) {
      return dependencies.sendSuccess(reply, payload);
    }

    return reply.send(payload);
  });
}

function parseLoginUserRequest(body: unknown): LoginUserInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Invalid request body.");
  }

  const input = body as Record<string, unknown>;
  const login = readString(input.credential ?? input.login ?? input.username ?? input.email);
  const password = readString(input.password);

  if (!login) {
    throw new BadRequestError("login is required.");
  }

  if (!password) {
    throw new BadRequestError("password is required.");
  }

  return {
    login,
    password
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
