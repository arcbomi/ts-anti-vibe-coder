export function parseTomorrowTokenResponse(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return { accessToken: "", responseError: "" };
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return { accessToken: String(JSON.parse(trimmed)).trim(), responseError: "" };
    } catch {
      return { accessToken: "", responseError: "" };
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      jwt?: string;
      token?: string;
      accessToken?: string;
      access_token?: string;
      error?: string;
      expiresAt?: string;
      tokenType?: string;
    };

    return {
      accessToken: String(parsed.jwt ?? parsed.token ?? parsed.accessToken ?? parsed.access_token ?? "").trim(),
      responseError: String(parsed.error ?? "").trim(),
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
      tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : undefined
    };
  } catch {
    return { accessToken: "", responseError: "" };
  }
}
