export type TomorrowAuthClient = {
  authenticate(input: {
    login: string;
    password: string;
  }): Promise<{
    accessToken: string;
    expiresAt?: string;
    tokenType?: string;
  }>;
};
