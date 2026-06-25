import { buildServiceMetadata } from "../utils/serviceMetadata.ts";
import type { ServiceStatus } from "../types/service.ts";

interface BuildServiceStatusInput {
  service: string;
  domain: string;
  ready: boolean;
}

export function buildServiceStatus(input: BuildServiceStatusInput): ServiceStatus {
  return {
    ...buildServiceMetadata(input.service, input.domain),
    ready: input.ready
  };
}
