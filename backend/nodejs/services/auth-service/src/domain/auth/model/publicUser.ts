import type { JwtClaims, PublicUser } from "../../../shared/contracts/auth.js";

export function applyClaimsToPublicUser(user: PublicUser, claims: JwtClaims): PublicUser {
  const firstName = firstNonEmpty(claims.first_name, user.first_name);
  const lastName = firstNonEmpty(claims.last_name, user.last_name);

  return {
    ...user,
    email: firstNonEmpty(claims.email, user.email),
    name: firstNonEmpty(claims.name, user.name),
    first_name: firstName,
    last_name: lastName,
    full_name: firstNonEmpty([firstName, lastName].filter(Boolean).join(" "), claims.name, user.name)
  };
}

export function deriveDisplayName(email: string, ...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const localPart = email.split("@")[0]?.trim();
  return localPart || "Tomorrow School User";
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
