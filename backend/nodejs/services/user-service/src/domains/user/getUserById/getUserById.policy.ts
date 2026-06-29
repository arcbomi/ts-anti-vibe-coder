import { BadRequestError } from "@backend/microservice-sdk";
import type { GetUserByIdInput } from "./getUserById.input.js";

export function assertGetUserByIdAllowed(input: GetUserByIdInput) {
  if (!String(input.userId ?? "").trim()) {
    throw new BadRequestError("userId is required.");
  }
}
