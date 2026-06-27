import { AppError, attachInternalAuthContext } from "@backend/microservice-sdk";
import { ERROR_CODE } from "../models/gitea.js";
import type { AuthenticatedRequest } from "../types/service.js";

export function requireGatewayAuth() {
  return async function bearerAuth(request: AuthenticatedRequest) {
    await attachInternalAuthContext(request);
    if (request.auth?.userId) {
      return;
    }

    throw new AppError("Authenticated gateway user context is required.", {
      statusCode: 401,
      code: ERROR_CODE.unauthorized
    });
  };
}
