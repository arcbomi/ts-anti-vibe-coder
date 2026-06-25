import path from "node:path";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE, type NormalizedRepository } from "../models/gitea.js";

export function normalizeRepositoryUrl(raw: string, allowedBaseUrl: string): NormalizedRepository {
  const value = raw.trim();
  if (!value) {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  const normalizedPath = parsed.pathname.replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  const parts = normalizedPath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  const baseSegments = parts.slice(0, -2);
  const projectSegments = parts.slice(-2);
  const basePath = baseSegments.length > 0 ? `/${baseSegments.join("/")}` : "";
  const baseUrl = `${parsed.protocol}//${parsed.host}${basePath}`;
  const configuredBaseUrl = allowedBaseUrl.replace(/\/+$/g, "");

  if (configuredBaseUrl && configuredBaseUrl.toLowerCase() !== baseUrl.toLowerCase()) {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  const projectPath = path.posix.normalize(projectSegments.join("/")).replace(/^\/+|\/+$/g, "");
  if (!projectPath || projectPath === "." || projectPath.includes("..")) {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  return {
    url: `${baseUrl.replace(/\/+$/g, "")}/${projectPath}`,
    projectPath,
    baseUrl: baseUrl.replace(/\/+$/g, "")
  };
}

export function parseRepositoryParts(repoUrl: string, allowedBaseUrl: string) {
  const normalized = normalizeRepositoryUrl(repoUrl, allowedBaseUrl);
  const parts = normalized.projectPath.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new AppError("The repository URL is invalid.", {
      statusCode: 400,
      code: ERROR_CODE.invalidRepositoryUrl
    });
  }

  return {
    owner: parts[0],
    repo: parts[1],
    normalized
  };
}
