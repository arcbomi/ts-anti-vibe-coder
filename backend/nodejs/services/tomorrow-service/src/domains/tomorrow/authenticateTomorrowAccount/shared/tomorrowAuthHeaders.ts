import type { TomorrowAuthRequest } from "./tomorrowAuthRequest.js";

export function tomorrowAuthHeaders(
  input: TomorrowAuthRequest,
  config: {
    referrer?: string;
    xJwtToken?: string;
    sessionId?: string;
  }
) {
  return {
    Accept: "*/*",
    "Content-Type": "application/json",
    Authorization: `Basic ${Buffer.from(`${input.login}:${input.password}`).toString("base64")}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "X-Jwt-Token": config.xJwtToken || "undefined",
    ...(config.sessionId ? { "X-Session-Id": config.sessionId } : {}),
    ...(config.referrer ? { Referer: config.referrer } : {})
  };
}
