import type { PublicUser, UserRecord, UserWriteRequest } from "../types/user.js";

export function buildUserRecord(input: UserWriteRequest): UserRecord {
  const timestamp = new Date().toISOString();

  return {
    id: input.id,
    email: input.email,
    name: input.name,
    firstName: input.firstName ?? "",
    lastName: input.lastName ?? "",
    username: input.username ?? "",
    loginCredential: input.loginCredential ?? "",
    loginPassword: input.loginPassword ?? "",
    passwordHash: input.passwordHash ?? "",
    authProvider: input.authProvider ?? "local",
    remoteToken: input.remoteToken ?? "",
    profilePath: input.profilePath ?? "",
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp
  };
}

export function toPublicUser(user: UserRecord): PublicUser {
  const firstName = user.firstName.trim();
  const lastName = user.lastName.trim();
  const [derivedFirstName, derivedLastName] =
    firstName || lastName ? [firstName, lastName] : deriveNameParts(user.name);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    full_name: firstNonEmpty(joinName(derivedFirstName, derivedLastName), user.name),
    first_name: derivedFirstName,
    last_name: derivedLastName,
    ...(user.username.trim() ? { username: user.username.trim() } : {})
  };
}

export function firstNonEmpty(...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function deriveNameParts(displayName: string): [string, string] {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return ["", ""];
  }
  if (parts.length === 1) {
    return [parts[0], ""];
  }

  return [parts[0], parts.slice(1).join(" ")];
}

function joinName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
