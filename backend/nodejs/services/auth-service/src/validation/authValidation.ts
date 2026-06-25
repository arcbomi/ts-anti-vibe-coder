import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { LoginRequest } from "../shared/contracts/auth.js";
import { normalizeCredential } from "../shared/http/request.js";

function ensureObject(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Invalid request body.", {
      statusCode: 400,
      code: "INVALID_REQUEST"
    });
  }

  return body as Record<string, unknown>;
}
export function validateLoginRequest(body: unknown): LoginRequest {
  const input = ensureObject(body);
  const credential = normalizeCredential({
    credential:
      typeof input.credential === "string"
        ? input.credential
        : typeof input.username === "string"
          ? input.username
          : typeof input.name === "string"
            ? input.name
            : typeof input.email === "string"
              ? input.email
              : "",
    email: typeof input.email === "string" ? input.email : ""
  });

  return {
    credential,
    email: typeof input.email === "string" ? input.email.trim() : undefined,
    password: typeof input.password === "string" ? input.password : ""
  };
}
