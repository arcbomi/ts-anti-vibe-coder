import type { PublicUser } from "../model/PublicUser.js";
import type { User } from "../model/User.js";

export type GetUserByIdOutput = {
  user: User;
  publicUser: PublicUser;
};
