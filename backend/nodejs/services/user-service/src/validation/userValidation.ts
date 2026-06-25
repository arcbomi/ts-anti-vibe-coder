import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { UpdateUserProfileRequest, UserWriteRequest } from "../types/user.js";

function ensureObject(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("Invalid request body.", {
      statusCode: 400,
      code: "INVALID_REQUEST"
    });
  }

  return body as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

export function validateUserWriteRequest(body: unknown): UserWriteRequest {
  const input = ensureObject(body);

  return {
    id: readString(input.id),
    email: readString(input.email),
    name: readString(input.name),
    firstName: readOptionalString(input.firstName),
    lastName: readOptionalString(input.lastName),
    username: readOptionalString(input.username),
    loginCredential: readOptionalString(input.loginCredential),
    loginPassword: readOptionalString(input.loginPassword),
    passwordHash: typeof input.passwordHash === "string" ? input.passwordHash : undefined,
    authProvider: input.authProvider === "tomorrow-school" ? "tomorrow-school" : input.authProvider === "local" ? "local" : undefined,
    remoteToken: typeof input.remoteToken === "string" ? input.remoteToken : undefined,
    profilePath: typeof input.profilePath === "string" ? input.profilePath : undefined,
    createdAt: readOptionalString(input.createdAt),
    updatedAt: readOptionalString(input.updatedAt)
  };
}

export function validateProfileUpdateRequest(body: unknown): UpdateUserProfileRequest {
  const input = ensureObject(body);

  return {
    name: readOptionalString(input.name),
    firstName: readOptionalString(input.firstName),
    lastName: readOptionalString(input.lastName),
    username: readOptionalString(input.username),
    profilePath: readOptionalString(input.profilePath)
  };
}

export function validateLookupQuery(query: unknown, field: "email" | "id" | "username") {
  const input = ensureObject(query);
  const value = readString(input[field]);
  if (!value) {
    throw new AppError(`Missing ${field}.`, {
      statusCode: 400,
      code: "INVALID_REQUEST"
    });
  }

  return { value };
}

export function validateExistsQuery(query: unknown) {
  const input = ensureObject(query);
  return {
    id: readOptionalString(input.id),
    email: readOptionalString(input.email),
    username: readOptionalString(input.username)
  };
}
