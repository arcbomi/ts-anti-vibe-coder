import { buildServiceStatus } from "../models/serviceStatus.ts";
import type { HealthRepositoryPort, ServiceStatus } from "../types.ts";

export class HealthRepository implements HealthRepositoryPort {
  serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  readStatus(): ServiceStatus {
    return buildServiceStatus({
      service: this.serviceName,
      version: "1.0.0",
      ready: true
    });
  }
}
