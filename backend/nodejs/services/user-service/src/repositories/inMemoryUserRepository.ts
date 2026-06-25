import type { UpdateUserProfileRequest, UserRecord, UserRepository } from "../types/user.js";

export class InMemoryUserRepository implements UserRepository {
  private readonly usersById = new Map<string, UserRecord>();
  private readonly usersByEmail = new Map<string, UserRecord>();
  private readonly usersByUsername = new Map<string, UserRecord>();

  async ensureSchema() {}

  async createUser(user: UserRecord) {
    const existing = this.usersByEmail.get(user.email);
    if (existing) {
      throw new Error("unique constraint violation: email");
    }

    this.persist(user);
    return this.clone(user);
  }

  async getUserByEmail(email: string) {
    const user = this.usersByEmail.get(email);
    return user ? this.clone(user) : null;
  }

  async getUserById(id: string) {
    const user = this.usersById.get(id);
    return user ? this.clone(user) : null;
  }

  async getUserByUsername(username: string) {
    const user = this.usersByUsername.get(username);
    return user ? this.clone(user) : null;
  }

  async updateUserForDevSeed(user: UserRecord) {
    const existing = this.usersByEmail.get(user.email);
    const updated: UserRecord = {
      ...(existing ?? user),
      ...user,
      id: existing?.id ?? user.id,
      createdAt: existing?.createdAt ?? user.createdAt,
      updatedAt: new Date().toISOString()
    };

    this.persist(updated);
    return this.clone(updated);
  }

  async upsertExternalUser(user: UserRecord) {
    const existing = this.usersByEmail.get(user.email);
    const upserted: UserRecord = existing
      ? {
          ...existing,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          loginCredential: user.loginCredential,
          loginPassword: user.loginPassword,
          authProvider: user.authProvider,
          remoteToken: user.remoteToken,
          profilePath: user.profilePath,
          updatedAt: new Date().toISOString()
        }
      : user;

    this.persist(upserted);
    return this.clone(upserted);
  }

  async updateUserProfile(id: string, updates: UpdateUserProfileRequest) {
    const existing = this.usersById.get(id);
    if (!existing) {
      return null;
    }

    const updated: UserRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.persist(updated);
    return this.clone(updated);
  }

  private persist(user: UserRecord) {
    const existing = this.usersById.get(user.id);
    if (existing?.username.trim()) {
      this.usersByUsername.delete(existing.username);
    }

    const clone = this.clone(user);
    this.usersById.set(clone.id, clone);
    this.usersByEmail.set(clone.email, clone);
    if (clone.username.trim()) {
      this.usersByUsername.set(clone.username, clone);
    }
  }

  private clone(user: UserRecord): UserRecord {
    return structuredClone(user);
  }
}
