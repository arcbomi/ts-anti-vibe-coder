import { NotFoundError } from "@backend/microservice-sdk";
import { toPublicUser } from "../model/toPublicUser.js";
import type { GetUserByIdInput } from "./getUserById.input.js";
import type { GetUserByIdOutput } from "./getUserById.output.js";
import { assertGetUserByIdAllowed } from "./getUserById.policy.js";

export function createGetUserById(deps: {
  userStore: {
    findById(input: { userId: string }): Promise<GetUserByIdOutput["user"] | null>;
  };
}) {
  return async function getUserById(input: GetUserByIdInput): Promise<GetUserByIdOutput> {
    assertGetUserByIdAllowed(input);

    const user = await deps.userStore.findById({
      userId: input.userId
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    return {
      user,
      publicUser: toPublicUser(user)
    };
  };
}
