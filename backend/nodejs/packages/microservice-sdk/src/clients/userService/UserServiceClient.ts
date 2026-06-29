export type UserServiceClient = {
  saveExternalUser(input: {
    provider: "tomorrow";
    externalUserId: string;
    externalLogin: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<{
    id: string;
    login?: string;
    username?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
  getUserById(input: {
    userId: string;
  }): Promise<{
    id: string;
    login?: string;
    username?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
};
