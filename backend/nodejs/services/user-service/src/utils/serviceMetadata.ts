export function buildServiceMetadata(service: string, domain: string) {
  return {
    service,
    domain,
    version: "1.0.0",
    checkedAt: new Date().toISOString()
  };
}
