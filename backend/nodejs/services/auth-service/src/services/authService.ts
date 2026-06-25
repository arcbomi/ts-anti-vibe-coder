import crypto from "node:crypto";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { UserServiceClient } from "../clients/userServiceClient.js";
import { buildAuthResponse } from "../models/auth.js";
import type {
  AuthResponse,
  AuthServiceConfig,
  ExternalIdentity,
  JwtClaims,
  LoginRequest,
  PublicUser,
  RegisterRequest,
  UserRecordEnvelope,
  UserWriteRequest
} from "../types/auth.js";
import { CredentialBox } from "../utils/credentialBox.js";
import { JwtManager } from "../utils/jwt.js";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "../utils/password.js";
import { normalizeCredential, normalizeEmail } from "../utils/request.js";
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
  }

  async register(request: RegisterRequest): Promise<AuthResponse> {
    const email = this.requireEmail(request.email);
    const name = request.name.trim();
    if (!name || request.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError("Invalid request.", {
        statusCode: 400,
        code: "INVALID_REQUEST"
      });
    }

    if (await this.userService.getUserByEmail(email)) {
      throw new AppError("Email already exists.", {
        statusCode: 409,
        code: "EMAIL_ALREADY_EXISTS"
      });
    }

    const created = await this.userService.createUser({
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: hashPassword(request.password),
      authProvider: "local"
    });

    return buildAuthResponse(created.publicUser, this.tokenManager.generate(created.publicUser));
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    const credential = normalizeCredential(request);
    if (!credential || !request.password.trim()) {
      throw new AppError("Invalid email or password.", {
        statusCode: 401,
        code: "INVALID_CREDENTIALS"
      });
    }

    const localUser = await this.findLocalUser(credential, request.email);
    if (
      localUser?.user.authProvider === "local" &&
      localUser.user.passwordHash &&
      verifyPassword(request.password, localUser.user.passwordHash)
    ) {
      return buildAuthResponse(localUser.publicUser, this.tokenManager.generate(localUser.publicUser));
    }

    const identity = await this.authenticator.authenticate(credential, request.password);
    const upserted = await this.userService.upsertExternalUser(this.buildExternalUserRecord(credential, request.password, identity));

    return buildAuthResponse(upserted.publicUser, this.tokenManager.generate(upserted.publicUser));
  }

  async currentUser(token: string): Promise<PublicUser> {
    const claims = this.tokenManager.validate(token);
    const user = await this.userService.getUserById(claims.sub);
    if (!user) {
      throw new AppError("Authentication is required.", {
        statusCode: 401,
        code: "UNAUTHORIZED"
      });
    }

    return this.applyClaims(user.publicUser, claims);
  }

  async ensureDevSeedUser(seed = this.config.devSeedUser) {
    if (!seed.enabled) {
      return null;
    }

    const email = this.requireEmail(seed.email);
    const name = seed.name.trim();
    if (!name || seed.password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError("Invalid dev seed configuration.", {
        statusCode: 500,
        code: "CONFIGURATION_ERROR"
      });
    }

    const user: UserWriteRequest = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: hashPassword(seed.password),
      authProvider: "local"
    };

    return this.userService.updateUserForDevSeed(user);
  }

  private requireEmail(email: string) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new AppError("Invalid request.", {
        statusCode: 400,
        code: "INVALID_REQUEST"
      });
    }

    return normalized;
  }

  private applyClaims(user: PublicUser, claims: JwtClaims) {
    const firstName = firstNonEmpty(claims.first_name, user.first_name);
    const lastName = firstNonEmpty(claims.last_name, user.last_name);

    return {
      ...user,
      email: firstNonEmpty(claims.email, user.email),
      name: firstNonEmpty(claims.name, user.name),
      first_name: firstName,
      last_name: lastName,
      full_name: firstNonEmpty([firstName, lastName].filter(Boolean).join(" "), claims.name, user.name)
    };
  }

  private async findLocalUser(credential: string, email?: string): Promise<UserRecordEnvelope | null> {
    const candidate = normalizeEmail(email ?? credential);
    if (!candidate) {
      return null;
    }

    return this.userService.getUserByEmail(candidate);
  }

  private buildExternalUserRecord(credential: string, password: string, identity: ExternalIdentity): UserWriteRequest {
    const email = this.requireEmail(identity.email);

    return {
      id: crypto.randomUUID(),
      email,
      name: deriveDisplayName(email, identity.fullName, identity.name, identity.username),
      firstName: identity.firstName,
      lastName: identity.lastName,
      username: identity.username,
      loginCredential: credential,
      loginPassword: this.credentialBox.encrypt(password),
      passwordHash: "",
      authProvider: "tomorrow-school",
      remoteToken: identity.remoteToken,
      profilePath: firstNonEmpty(identity.profilePath, this.config.tomorrowSchool.profilePath)
    };
  }
}

function deriveDisplayName(email: string, ...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const localPart = email.split("@")[0]?.trim();
  return localPart || "Tomorrow School User";
}

function firstNonEmpty(...values: string[]) {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}
