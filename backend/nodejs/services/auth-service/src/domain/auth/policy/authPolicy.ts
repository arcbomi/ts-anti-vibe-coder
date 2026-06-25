import { AppError } from "../../../../../../packages/microservice-sdk/src/index.js";
import { normalizeEmail } from "../../../shared/http/request.js";

export function requireEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new AppError("Invalid request.", {
      statusCode: 400,
      code: "INVALID_REQUEST"
    });
  }

  return normalized;
}
