import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { LoginRequest, RegisterRequest } from "../types/auth.js";
import { normalizeCredential } from "../utils/request.js";

function ensureObject(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Invalid request body.", {
      statusCode: 400,
      code: "INVALID_REQUEST"
    });
  }

  return body as Record<string, unknown>;
}

export function validateRegisterRequest(body: unknown): RegisterRequest {
  const input = ensureObject(body);

  return {
    email: typeof input.email === "string" ? input.email.trim() : "",
    name: typeof input.name === "string" ? input.name.trim() : "",
    password: typeof input.password === "string" ? input.password : ""
  };
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
