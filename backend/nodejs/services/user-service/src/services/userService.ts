import { AppError } from "@backend/microservice-sdk";
import { buildUserRecord, toPublicUser } from "../models/user.js";
import type { UpdateUserProfileRequest, UserRecord, UserRecordEnvelope, UserRepository, UserWriteRequest } from "../types/user.js";

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async createUser(input: UserWriteRequest) {
    const existing = await this.repository.getUserByEmail(input.email);
    if (existing) {
      throw new AppError("Email already exists.", {
        statusCode: 409,
        code: "EMAIL_ALREADY_EXISTS"
      });
    }

    return this.present(await this.repository.createUser(buildUserRecord(input)));
  }

  async getUserByEmail(email: string) {
    const user = await this.repository.getUserByEmail(email);
    return user ? this.present(user) : null;
  }

  async getUserById(id: string) {
    const user = await this.repository.getUserById(id);
    return user ? this.present(user) : null;
  }

  async getUserByUsername(username: string) {
    const user = await this.repository.getUserByUsername(username);
    return user ? this.present(user) : null;
  }

  async getPublicUserById(id: string) {
    const user = await this.repository.getUserById(id);
    return user ? toPublicUser(user) : null;
  }

  async updateUserForDevSeed(input: UserWriteRequest) {
    const existing = await this.repository.getUserByEmail(input.email);
    if (!existing) {
      return this.present(await this.repository.createUser(buildUserRecord(input)));
    }

    return this.present(await this.repository.updateUserForDevSeed(buildUserRecord(input)));
  }

  async upsertExternalUser(input: UserWriteRequest) {
    return this.present(await this.repository.upsertExternalUser(buildUserRecord(input)));
  }

  async updateProfile(id: string, updates: UpdateUserProfileRequest) {
    const user = await this.repository.updateUserProfile(id, updates);
    if (!user) {
      throw new AppError("User not found.", {
        statusCode: 404,
        code: "USER_NOT_FOUND"
      });
    }

    return this.present(user);
  }

  async exists(filters: { id?: string; email?: string; username?: string }) {
    if (filters.id) {
      return Boolean(await this.repository.getUserById(filters.id));
    }
    if (filters.email) {
      return Boolean(await this.repository.getUserByEmail(filters.email));
    }
    if (filters.username) {
      return Boolean(await this.repository.getUserByUsername(filters.username));
    }

    throw new AppError("At least one lookup value is required.", {
      statusCode: 400,
      code: "INVALID_REQUEST"
    });
  }

  private present(user: UserRecord): UserRecordEnvelope {
    return {
      user,
      publicUser: toPublicUser(user)
    };
  }
}
