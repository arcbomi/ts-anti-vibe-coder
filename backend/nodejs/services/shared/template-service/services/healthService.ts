import type { HealthRepositoryPort, ServiceStatus } from "../types.ts";

export class HealthService {
  healthRepository: HealthRepositoryPort;

  constructor(healthRepository: HealthRepositoryPort) {
    this.healthRepository = healthRepository;
  }

  getStatus(): ServiceStatus {
    return this.healthRepository.readStatus();
  }
}
