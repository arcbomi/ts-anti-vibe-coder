import type { User } from "../model/User.js";

export type UserStore = {
  ensureSchema(): Promise<void>;
  saveExternalUser(input: {
    provider: "tomorrow";
    externalUserId: string;
    externalLogin: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<User>;
  findById(input: {
    userId: string;
  }): Promise<User | null>;
  findByExternalIdentity(input: {
    provider: "tomorrow";
    externalUserId: string;
  }): Promise<User | null>;
};
