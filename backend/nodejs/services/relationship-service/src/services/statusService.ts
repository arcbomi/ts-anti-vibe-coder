import type { ServiceStatusRepository } from "../repositories/statusRepository.ts";
import type { ServiceStatus } from "../types/service.ts";

export class StatusService {
  constructor(private readonly statusRepository: ServiceStatusRepository) {}

  getStatus(): ServiceStatus {
    return this.statusRepository.readStatus();
  }
}
