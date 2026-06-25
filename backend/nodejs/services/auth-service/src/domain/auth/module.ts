import { UserServiceClient } from "../../clients/userServiceClient.js";
import { AuthController } from "../../controllers/authController.js";
import { AuthService } from "../../services/authService.js";
import { TomorrowSchoolAuthService } from "../../services/tomorrowSchoolAuthService.js";
import type { AuthServiceConfig } from "../../shared/contracts/auth.js";

export function buildAuthDomainModule(input: {
  config: AuthServiceConfig;
  logger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
}) {
  const authenticator = new TomorrowSchoolAuthService(input.config.tomorrowSchool);
  const userService = new UserServiceClient(input.config.userService);
  const authService = new AuthService({
    userService,
    config: input.config,
    authenticator,
    logger: input.logger
  });
  const authController = new AuthController({ authService });

  return {
    authController,
    authService
  };
}
