export type TomorrowServiceClient = {
  authenticateTomorrowAccount(input: {
    login: string;
    password: string;
  }): Promise<{
    accessToken: string;
    expiresAt?: string;
    tokenType?: string;
  }>;
  getTomorrowUserInformation(input: {
    accessToken: string;
  }): Promise<{
    id: string;
    login: string;
    email?: string;
    displayName?: string;
  }>;
};
