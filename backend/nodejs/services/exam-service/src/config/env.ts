import { AppError } from "@backend/microservice-sdk";
import type { ExamServiceConfig } from "../types/service.js";

function requireEnv(name: string, fallback = "") {
  const value = (process.env[name] ?? fallback).trim();
  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  return value;
}

export function loadExamServiceConfig(): ExamServiceConfig {
  return {
    serviceName: "exam-service",
    port: Number(process.env.EXAM_SERVICE_PORT ?? "3006"),
    internalToken: requireEnv("EXAM_SERVICE_INTERNAL_TOKEN", "change-me"),
    passingScore: Number(process.env.EXAM_SERVICE_PASSING_SCORE ?? "14"),
    examOpenDay: (process.env.EXAM_SERVICE_OPEN_DAY ?? "friday").trim().toLowerCase()
  };
}
