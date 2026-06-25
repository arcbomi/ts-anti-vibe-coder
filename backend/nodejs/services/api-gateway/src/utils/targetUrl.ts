export function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildUpstreamUrl(baseUrl: string, path: string, queryString: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return queryString ? `${normalizedBaseUrl}${normalizedPath}?${queryString}` : `${normalizedBaseUrl}${normalizedPath}`;
}
