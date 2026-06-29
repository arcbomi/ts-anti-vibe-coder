export type SaveExternalUserInput = {
  provider: "tomorrow";
  externalUserId: string;
  externalLogin: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
};
