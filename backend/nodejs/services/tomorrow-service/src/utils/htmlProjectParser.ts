import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { buildProject } from "../models/project.js";
import type { TomorrowProject } from "../types/tomorrow.js";
import { normalizeText, slugify } from "./string.js";

const STATUS_TEXTS = [
  "Project succeeded",
  "Project failed",
  "In progress",
  "Unavailable",
  "Missing audit",
  "Locked"
];

const AUDIT_PATTERN = /\b\d+\s+peer audits?\s+required\b/i;

export function parseProjectsFromProfileHtml({
  profileHtml,
  baseUrl,
  username
}: {
  profileHtml: string;
  baseUrl: string;
  username: string;
}) {
  const cardMatches = [...String(profileHtml ?? "").matchAll(/<article\b[\s\S]*?<\/article>/gi)];
  if (cardMatches.length === 0) {
    throw new AppError("Tomorrow profile format changed: no project cards found", {
      statusCode: 502,
      code: "TOMORROW_PROFILE_FORMAT_CHANGED"
    });
  }

  const seen = new Set<string>();
  const projects: TomorrowProject[] = [];
  for (const match of cardMatches) {
    const project = parseProjectCard(match[0], baseUrl, username);
    if (!project || seen.has(project.id)) {
      continue;
    }

    seen.add(project.id);
    projects.push(project);
  }

  if (projects.length === 0) {
    throw new AppError("Tomorrow profile format changed: no recognizable project data", {
      statusCode: 502,
      code: "TOMORROW_PROFILE_FORMAT_CHANGED"
    });
  }

  return projects;
}

function parseProjectCard(cardHtml: string, baseUrl: string, username: string) {
  const status = extractStatus(cardHtml);
  if (!status) {
    return null;
  }

  const name = extractName(cardHtml);
  const repoUrl = extractRepoUrl(cardHtml, baseUrl, username, name);
  const slug = extractSlug(repoUrl, name);
  if (!slug) {
    return null;
  }

  return buildProject({
    id: slug,
    slug,
    name: name || slug,
    repoUrl,
    status,
    auditText: extractAuditText(cardHtml),
    isSucceeded: status === "Project succeeded"
  });
}

function extractStatus(cardHtml: string) {
  const plainText = toPlainText(cardHtml);
  return STATUS_TEXTS.find((status) => plainText.includes(status)) ?? "";
}

function extractName(cardHtml: string) {
  const headingMatch = cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (headingMatch) {
    return normalizeText(stripTags(headingMatch[1]));
  }

  const anchorMatch = cardHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  return anchorMatch ? normalizeText(stripTags(anchorMatch[1])) : "";
}

function extractAuditText(cardHtml: string) {
  const plainText = toPlainText(cardHtml);
  const match = plainText.match(AUDIT_PATTERN);
  return match ? normalizeText(match[0]) : "";
}

function extractRepoUrl(cardHtml: string, baseUrl: string, username: string, name: string) {
  const hrefMatch = cardHtml.match(/<a\b[^>]*href=["']([^"']*\/git\/[^"']+)["'][^>]*>/i);
  if (hrefMatch) {
    return absolutizeUrl(baseUrl, hrefMatch[1]);
  }

  const slug = slugify(name);
  return slug ? `${String(baseUrl).replace(/\/+$/, "")}/git/${username}/${slug}` : "";
}

function extractSlug(repoUrl: string, name: string) {
  if (repoUrl) {
    const url = new URL(repoUrl);
    return slugify(url.pathname.split("/").at(-1));
  }

  return slugify(name);
}

function absolutizeUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function stripTags(value: string) {
  return String(value ?? "").replace(/<[^>]+>/g, " ");
}

function toPlainText(value: string) {
  return normalizeText(stripTags(value));
}
