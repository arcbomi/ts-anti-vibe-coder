import { BadRequestError } from "@backend/microservice-sdk";
import type { SaveExternalUserInput } from "./saveExternalUser.input.js";

export function assertSaveExternalUserAllowed(input: SaveExternalUserInput) {
  if (input.provider !== "tomorrow") {
    throw new BadRequestError("provider must be tomorrow.");
  }

  if (!String(input.externalUserId ?? "").trim()) {
    throw new BadRequestError("externalUserId is required.");
  }

  if (!String(input.externalLogin ?? "").trim()) {
    throw new BadRequestError("externalLogin is required.");
  }
}
