import type { CurrentUser } from "./CurrentUser.js";

export type AuthResponse = {
  accessToken: string;
  user: CurrentUser;
};
