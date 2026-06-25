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

export type UpdateUserProfileRequest = {
  name?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profilePath?: string;
};

export type UserRecordEnvelope = {
  user: UserRecord;
  publicUser: PublicUser;
};

export interface UserRepository {
  ensureSchema(): Promise<void>;
  createUser(user: UserRecord): Promise<UserRecord>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByUsername(username: string): Promise<UserRecord | null>;
  updateUserForDevSeed(user: UserRecord): Promise<UserRecord>;
  upsertExternalUser(user: UserRecord): Promise<UserRecord>;
  updateUserProfile(id: string, updates: UpdateUserProfileRequest): Promise<UserRecord | null>;
}
