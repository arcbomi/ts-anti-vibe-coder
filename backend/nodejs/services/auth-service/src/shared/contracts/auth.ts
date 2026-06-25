export type AuthServiceConfig = {
  serviceName: string;
  port: number;
  appEnv: string;
  credentialSecret: string;
  userService: {
    baseUrl: string;
    internalToken: string;
    timeoutMs: number;
  };
  jwt: {
    secret: string;
    accessTokenTtlMinutes: number;
  };
  tomorrowSchool: {
    endpoint: string;
    graphQlEndpoint: string;
    graphQlRole: string;
    timeoutMs: number;
    referrer: string;
    xJwtToken: string;
    sessionId: string;
    profilePath: string;
  };
  devSeedUser: {
    enabled: boolean;
    name: string;
    email: string;
    password: string;
  };
};

export type AuthProvider = "local" | "tomorrow-school";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  loginCredential: string;
  loginPassword: string;
  passwordHash: string;
  authProvider: AuthProvider;
  remoteToken: string;
  profilePath: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  full_name: string;
  first_name: string;
  last_name: string;
  username?: string;
};

export type RegisterRequest = {
  email: string;
  name: string;
  password: string;
};

export type LoginRequest = {
  credential: string;
  email?: string;
  password: string;
};

export type AuthResponse = {
  user: PublicUser;
  access_token: string;
};

export type MeResponse = {
  user: PublicUser;
};

export type MessageResponse = {
  message: string;
};

export type JwtClaims = {
  sub: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  iat: number;
  exp: number;
};

export type ExternalIdentity = {
  email: string;
  name: string;
  fullName: string;
  firstName: string;
  lastName: string;
  username: string;
  remoteToken: string;
  profilePath: string;
};

export type UserWriteRequest = {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  loginCredential?: string;
  loginPassword?: string;
  passwordHash?: string;
  authProvider?: AuthProvider;
  remoteToken?: string;
  profilePath?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UserRecordEnvelope = {
  user: UserRecord;
  publicUser: PublicUser;
};

export type TomorrowSchoolGraphQlResponse = {
  data?: {
    user?: {
      login?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
  };
  errors?: Array<{
    message?: string;
  }>;
};
