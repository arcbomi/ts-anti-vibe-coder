export function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function toIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
