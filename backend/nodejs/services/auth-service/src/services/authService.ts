import { UserServiceClient } from "../clients/userServiceClient.js";
import { AuthUsers } from "../domain/auth/data/authUsers.js";
import { loginUser } from "../domain/auth/usecase/loginUser.js";
import { readCurrentUser } from "../domain/auth/usecase/readCurrentUser.js";
import type { AuthResponse, AuthServiceConfig, LoginRequest, PublicUser } from "../shared/contracts/auth.js";
import { CredentialBox } from "../shared/security/credentialBox.js";
import { JwtManager } from "../shared/security/jwt.js";
import { TomorrowSchoolAuthService } from "./tomorrowSchoolAuthService.js";

export class AuthService {
  userService: UserServiceClient;
  config: AuthServiceConfig;
  authenticator: TomorrowSchoolAuthService;
  logger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
  tokenManager: JwtManager;
  credentialBox: CredentialBox;
  authUsers: AuthUsers;

  constructor(input: {
    userService: UserServiceClient;
    config: AuthServiceConfig;
    authenticator: TomorrowSchoolAuthService;
    logger: AuthService["logger"];
  }) {
    this.userService = input.userService;
    this.config = input.config;
    this.authenticator = input.authenticator;
    this.logger = input.logger;
    this.tokenManager = new JwtManager({
      secret: input.config.jwt.secret,
      ttlMinutes: input.config.jwt.accessTokenTtlMinutes
    });
    this.credentialBox = new CredentialBox(input.config.credentialSecret || input.config.jwt.secret);
    this.authUsers = new AuthUsers(input.userService);
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    return loginUser(request, {
      authUsers: this.authUsers,
      authenticator: this.authenticator,
      config: this.config,
      credentialBox: this.credentialBox,
      tokenManager: this.tokenManager
    });
  }

  async currentUser(token: string): Promise<PublicUser> {
    return readCurrentUser(token, {
      tokenManager: this.tokenManager
    });
  }
}
