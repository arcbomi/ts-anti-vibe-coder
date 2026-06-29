export type TomorrowTokenStore = {
  save(input: {
    userId: string;
    tomorrowUserId: string;
    tomorrowLogin: string;
    accessToken: string;
    expiresAt?: string;
  }): Promise<void>;
  delete(input: {
    userId: string;
  }): Promise<void>;
};
