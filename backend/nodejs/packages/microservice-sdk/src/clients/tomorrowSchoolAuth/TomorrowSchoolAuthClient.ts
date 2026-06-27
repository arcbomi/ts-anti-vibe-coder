export type TomorrowSchoolAuthClient = {
  login(input: {
    login: string;
    password: string;
  }): Promise<{
    externalId: string;
    login: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }>;
};
