import type { TomorrowUser } from "../../model/TomorrowUser.js";

export type TomorrowUserClient = {
  getCurrentUser(input: {
    accessToken: string;
  }): Promise<TomorrowUser>;
};
