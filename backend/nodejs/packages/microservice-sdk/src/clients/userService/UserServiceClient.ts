export type UserServiceClient = {
  findOrCreateFromExternalUser(input: {
    provider: "tomorrow_school";
    externalId: string;
    login: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<{
    id: string;
    login?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
  getCurrentUser(input: {
    userId: string;
  }): Promise<{
    id: string;
    login?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
};
