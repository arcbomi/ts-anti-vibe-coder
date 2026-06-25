import type { ExternalIdentity } from "../types/auth.js";

const INVALID_CREDENTIALS_MESSAGE = "User does not exist or password incorrect";

export function buildTomorrowSchoolAuthHeaders(input: {
  credential: string;
  password: string;
  referrer: string;
  xJwtToken: string;
  sessionId: string;
}) {
  return {
    Accept: "*/*",
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${input.credential}:${input.password}`).toString("base64")}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Jwt-Token": input.xJwtToken || "undefined",
    ...(input.sessionId ? { "X-Session-Id": input.sessionId } : {}),
    ...(input.referrer ? { Referer: input.referrer } : {})
  };
}

export function extractTomorrowSchoolToken(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return { token: "", responseError: "" };
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return { token: String(JSON.parse(trimmed)).trim(), responseError: "" };
    } catch {
      return { token: "", responseError: "" };
    }
  }

  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    return {
      token: String(payload.jwt ?? payload.access_token ?? payload.token ?? "").trim(),
      responseError: String(payload.error ?? "").trim(),
      user: payload.user as Record<string, unknown> | undefined
    };
  } catch {
    return { token: "", responseError: "" };
  }
}

export function parseTomorrowSchoolJwtClaims(token: string) {
  const payload = token.split(".")[1];
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function isTomorrowSchoolInvalidCredentials(status: number, responseError: string) {
  return status === 401 || status === 403 || responseError.trim() === INVALID_CREDENTIALS_MESSAGE;
}

export function buildTomorrowSchoolIdentity(input: {
  credential: string;
  token: string;
  claims: Record<string, unknown>;
  user?: Record<string, unknown>;
  profilePath: string;
  profile?: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}): ExternalIdentity {
  const email = firstNonEmpty(
    input.profile?.email ?? "",
    toString(input.user?.email),
    toString(input.claims.email),
    input.credential.includes("@") ? input.credential : ""
  );
  const firstName = firstNonEmpty(input.profile?.firstName ?? "");
  const lastName = firstNonEmpty(input.profile?.lastName ?? "");
  const username = firstNonEmpty(input.profile?.login ?? "", toString(input.user?.username), input.credential.includes("@") ? "" : input.credential);
  const fullName = firstNonEmpty(
    joinName(firstName, lastName),
    toString(input.user?.full_name),
    toString(input.user?.name),
    toString(input.claims.name),
    username,
    input.credential
  );

  return {
    email: email || fallbackEmail(toString(input.claims.sub), input.credential),
    name: fullName,
    fullName,
    firstName,
    lastName,
    username,
    remoteToken: input.token,
    profilePath: input.profilePath
  };
}

function fallbackEmail(subject: string, credential: string) {
  if (credential.includes("@")) {
    return credential.trim().toLowerCase();
  }
  if (subject.trim()) {
    return `tomorrow-school-${subject.trim()}@tomorrow-school.local`;
  }
  return "";
}

function toString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function joinName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function firstNonEmpty(...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}
