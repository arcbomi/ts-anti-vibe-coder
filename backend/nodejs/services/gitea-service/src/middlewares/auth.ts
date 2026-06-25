import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE } from "../models/gitea.js";
import { JwtValidator } from "../utils/jwt.js";
import type { AuthenticatedRequest } from "../types/service.js";

export function requireBearerAuth(jwtValidator: JwtValidator) {
  return async function bearerAuth(request: AuthenticatedRequest) {
    const authorization = typeof request.headers.authorization === "string" ? request.headers.authorization : "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw new AppError("Bearer token is required", {
        statusCode: 401,
        code: ERROR_CODE.unauthorized
      });
    }

    const claims = jwtValidator.validate(token);
    request.userContext = { userId: claims.sub ?? "" };
  };
}
