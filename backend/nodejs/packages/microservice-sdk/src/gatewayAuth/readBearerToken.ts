export function readBearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  const normalized = String(value ?? "").trim();
  if (!/^bearer\s+/i.test(normalized)) {
    return "";
  }

  return normalized.replace(/^bearer\s+/i, "").trim();
}
