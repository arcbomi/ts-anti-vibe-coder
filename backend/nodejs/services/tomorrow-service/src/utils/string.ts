export function firstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeUrl(value: unknown) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

export function normalizeProjectPath(value: unknown) {
  return String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

export function pathBase(value: unknown) {
  const normalized = normalizeProjectPath(value);
  if (!normalized) {
    return "";
  }

  return normalized.split("/").at(-1) ?? "";
}

export function slugify(value: unknown) {
  const slug = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || slug === "git" || slug === "profile") {
    return "";
  }

  return slug;
}
