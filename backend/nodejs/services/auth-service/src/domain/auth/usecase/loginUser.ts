import crypto from "node:crypto";
import { AppError } from "../../../../../../packages/microservice-sdk/src/index.js";
import type { AuthUsers } from "../data/authUsers.js";
import { deriveDisplayName } from "../model/publicUser.js";
import { buildAuthResponse } from "../model/authResponses.js";
import type {
  AuthServiceConfig,
  ExternalIdentity,
  LoginRequest,
  UserWriteRequest
} from "../../../shared/contracts/auth.js";
import type { CredentialBox } from "../../../shared/security/credentialBox.js";
import type { JwtManager } from "../../../shared/security/jwt.js";
import { normalizeCredential } from "../../../shared/http/request.js";
import type { TomorrowSchoolAuthService } from "../../../services/tomorrowSchoolAuthService.js";
import { requireEmail } from "../policy/authPolicy.js";

export async function loginUser(
  request: LoginRequest,
  dependencies: {
    authUsers: AuthUsers;
    authenticator: TomorrowSchoolAuthService;
    config: AuthServiceConfig;
    credentialBox: CredentialBox;
    tokenManager: JwtManager;
  }
) {
  const credential = normalizeCredential(request);
  if (!credential || !request.password.trim()) {
    throw new AppError("Invalid email or password.", {
      statusCode: 401,
      code: "INVALID_CREDENTIALS"
    });
  }

  const identity = await dependencies.authenticator.authenticate(credential, request.password);
  const upserted = await dependencies.authUsers.upsertExternal(
    buildExternalUserRecord({
      credential,
      password: request.password,
      identity,
      config: dependencies.config,
      credentialBox: dependencies.credentialBox
    })
  );

  return buildAuthResponse(upserted.publicUser, dependencies.tokenManager.generate(upserted.publicUser));
}

function buildExternalUserRecord(input: {
  credential: string;
  password: string;
  identity: ExternalIdentity;
  config: AuthServiceConfig;
  credentialBox: CredentialBox;
}): UserWriteRequest {
  const email = requireEmail(input.identity.email);

  return {
    id: crypto.randomUUID(),
    email,
    name: deriveDisplayName(email, input.identity.fullName, input.identity.name, input.identity.username),
    firstName: input.identity.firstName,
    lastName: input.identity.lastName,
    username: input.identity.username,
    loginCredential: input.credential,
    loginPassword: input.credentialBox.encrypt(input.password),
    passwordHash: "",
    authProvider: "tomorrow-school",
    remoteToken: input.identity.remoteToken,
    profilePath: input.identity.profilePath || input.config.tomorrowSchool.profilePath
  };
}
