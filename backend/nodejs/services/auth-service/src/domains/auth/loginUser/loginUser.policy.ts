import { BadRequestError } from "@backend/microservice-sdk";
import type { LoginUserInput } from "./loginUser.input.js";

export function assertLoginInputAllowed(input: LoginUserInput) {
  if (!input.login.trim() || !input.password.trim()) {
    throw new BadRequestError("Login and password are required.");
  }
}
