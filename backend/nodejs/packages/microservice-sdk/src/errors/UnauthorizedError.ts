import { AppError } from "./AppError.js";

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.", details?: unknown) {
    super(message, {
      statusCode: 401,
      code: "UNAUTHORIZED",
      details
    });
  }
}
