export type TomorrowJwtClaims = {
  sub?: string | number;
  exp?: number;
};

export function readTomorrowJwtClaims(token: string): TomorrowJwtClaims {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length < 2) {
    return {};
  }

  try {
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(payload) as TomorrowJwtClaims;
  } catch {
    return {};
  }
}
