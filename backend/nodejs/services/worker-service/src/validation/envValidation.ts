import { AppError } from "@backend/microservice-sdk";

export function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(`${name} is required.`, {
      statusCode: 500,
      code: "SERVICE_CONFIG_INVALID"
    });
  }

  return value.trim();
}

export function readPositiveInt(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError(`${name} must be a non-negative integer.`, {
      statusCode: 500,
      code: "SERVICE_CONFIG_INVALID"
    });
  }

  return value;
}
