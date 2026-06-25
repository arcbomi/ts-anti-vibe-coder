export function extractBearerToken(authorizationHeader?: string) {
  const value = String(authorizationHeader ?? "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return value.slice(7).trim();
}

export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  return valid ? normalized : "";
}

export function normalizeCredential(input: { credential?: string; email?: string }) {
  return String(input.credential ?? input.email ?? "").trim();
}
