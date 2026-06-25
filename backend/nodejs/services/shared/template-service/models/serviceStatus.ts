import type { ServiceStatus } from "../types.ts";

interface BuildServiceStatusOptions {
  service: string;
  version: string;
  ready: boolean;
}

export function buildServiceStatus({
  service,
  version,
  ready
}: BuildServiceStatusOptions): ServiceStatus {
  return {
    service,
    version,
    ready,
    checkedAt: new Date().toISOString()
  };
}
