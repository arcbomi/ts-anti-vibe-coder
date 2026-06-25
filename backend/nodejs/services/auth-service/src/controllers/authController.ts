import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../../../packages/microservice-sdk/src/index.js";
import { buildLogoutResponse, buildMeResponse } from "../models/auth.js";
import type { LoginRequest } from "../shared/contracts/auth.js";
import { validateLoginRequest } from "../validation/authValidation.js";

type AuthControllerDependencies = {
  authService: {
    login(input: LoginRequest): Promise<unknown>;
  };
};

export class AuthController {
  authService: AuthControllerDependencies["authService"];

  constructor({ authService }: AuthControllerDependencies) {
    this.authService = authService;
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const response = await this.authService.login(validateLoginRequest(request.body));
    return sendSuccess(reply, response);
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    return sendSuccess(reply, buildLogoutResponse());
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    if (!request.authUser) {
      throw new Error("Authenticated user missing from request context");
    }

    return sendSuccess(reply, buildMeResponse(request.authUser));
  }
}
