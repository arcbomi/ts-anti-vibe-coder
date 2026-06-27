import { BadRequestError } from "@backend/microservice-sdk";
import type { AuthenticateTomorrowAccountInput } from "./authenticateTomorrowAccount.input.js";

export function assertTomorrowLoginAllowed(input: AuthenticateTomorrowAccountInput) {
  if (!input.login.trim() || !input.password.trim()) {
    throw new BadRequestError("Login and password are required");
  }
}
