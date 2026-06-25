import type { UserServiceConfig } from "../types/service.js";
import type { UserRepository } from "../types/user.js";
import { InMemoryUserRepository } from "./inMemoryUserRepository.js";
import { PostgresUserRepository } from "./postgresUserRepository.js";

export function buildUserRepository(config: UserServiceConfig): UserRepository {
  if (config.repository.driver === "database") {
    return new PostgresUserRepository(config.repository.databaseUrl);
  }

  return new InMemoryUserRepository();
}
