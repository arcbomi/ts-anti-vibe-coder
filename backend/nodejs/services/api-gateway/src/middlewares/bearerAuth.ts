import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE } from "../models/gateway.js";
import type { ApiGatewayRequest, JwtValidator } from "../types/service.js";

export function requireBearerAuth(jwtValidator: JwtValidator) {
  return async function bearerAuth(request: ApiGatewayRequest) {
    const authorization = typeof request.headers.authorization === "string" ? request.headers.authorization : "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw new AppError("Bearer token is required.", {
        statusCode: 401,
        code: ERROR_CODE.unauthorized
      });
    }

    request.userContext = jwtValidator.validate(token);
  };
}
