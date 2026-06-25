import { buildServiceStatus } from "../models/serviceStatus.ts";
import type { ServiceStatus } from "../types/service.ts";

export class ServiceStatusRepository {
  constructor(
    private readonly serviceName: string,
    private readonly serviceDomain: string
  ) {}

  readStatus(): ServiceStatus {
    return buildServiceStatus({
      service: this.serviceName,
      domain: this.serviceDomain,
      ready: true
    });
  }
}
