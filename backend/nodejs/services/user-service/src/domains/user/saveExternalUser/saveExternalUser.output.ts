import type { PublicUser } from "../model/PublicUser.js";
import type { User } from "../model/User.js";

export type SaveExternalUserOutput = {
  user: User;
  publicUser: PublicUser;
};
