import type { UserServiceClient } from "@backend/microservice-sdk";
import type { CurrentUser } from "../model/CurrentUser.js";
import type { ReadCurrentUserInput } from "./readCurrentUser.input.js";
import type { ReadCurrentUserOutput } from "./readCurrentUser.output.js";

export function createReadCurrentUser(dependencies: {
  userService: UserServiceClient;
}) {
  return async function readCurrentUser(input: ReadCurrentUserInput): Promise<ReadCurrentUserOutput> {
    const user = await dependencies.userService.getUserById({
      userId: input.userId
    });

    return {
      user: toCurrentUser(user)
    };
  };
}

function toCurrentUser(user: Awaited<ReturnType<UserServiceClient["getUserById"]>>): CurrentUser {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  };
}
