import { AppError } from "@backend/microservice-sdk";

export function validatePort(rawValue: string, fieldName: string): number {
  const port = Number(rawValue);
  if (!Number.isInteger(port) || port <= 0) {
    throw new AppError(`${fieldName} must be a positive integer.`, {
      statusCode: 500,
      code: "SERVICE_CONFIG_INVALID"
    });
  }

  return port;
}
