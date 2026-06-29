import type { PublicUser } from "./PublicUser.js";
import type { User } from "./User.js";

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    login: user.login,
    username: user.username,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
