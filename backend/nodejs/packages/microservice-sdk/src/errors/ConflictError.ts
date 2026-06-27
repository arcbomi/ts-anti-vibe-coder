import { AppError } from "./AppError.js";

export class ConflictError extends AppError {
  constructor(message = "Conflict.", details?: unknown) {
    super(message, {
      statusCode: 409,
      code: "CONFLICT",
      details
    });
  }
}
