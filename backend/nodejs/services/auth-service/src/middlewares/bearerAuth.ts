import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { AuthService } from "../services/authService.js";
import { extractBearerToken } from "../utils/request.js";

export function requireBearerAuth(authService: AuthService) {
  return async function bearerAuth(request: {
    headers: Record<string, unknown>;
    authUser?: Awaited<ReturnType<AuthService["currentUser"]>>;
  }) {
    const token = extractBearerToken(typeof request.headers.authorization === "string" ? request.headers.authorization : "");
    if (!token) {
      throw new AppError("Bearer token is required", {
        statusCode: 401,
        code: "UNAUTHORIZED"
      });
    }

    request.authUser = await authService.currentUser(token);
  };
}
