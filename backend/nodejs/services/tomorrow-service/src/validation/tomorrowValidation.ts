import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { DiscoverProjectsInput } from "../types/tomorrow.js";

export function validateDiscoverProjectsInput(body: DiscoverProjectsInput = {}): DiscoverProjectsInput {
  if (body !== null && typeof body !== "object") {
    throw new AppError("Request body must be a JSON object", {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }

  const input = {
    profilePath: typeof body.profilePath === "string" ? body.profilePath.trim() : undefined,
    username: typeof body.username === "string" ? body.username.trim() : undefined,
    password: typeof body.password === "string" ? body.password.trim() : undefined,
    remoteToken: typeof body.remoteToken === "string" ? body.remoteToken.trim() : undefined
  };

  if (input.profilePath === "") {
    throw new AppError("profilePath cannot be empty", {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }

  return input;
}
