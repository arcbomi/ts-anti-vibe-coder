import { toPublicUser } from "../model/toPublicUser.js";
import type { SaveExternalUserInput } from "./saveExternalUser.input.js";
import type { SaveExternalUserOutput } from "./saveExternalUser.output.js";
import { assertSaveExternalUserAllowed } from "./saveExternalUser.policy.js";

export function createSaveExternalUser(deps: {
  userStore: {
    saveExternalUser(input: SaveExternalUserInput): Promise<SaveExternalUserOutput["user"]>;
  };
}) {
  return async function saveExternalUser(input: SaveExternalUserInput): Promise<SaveExternalUserOutput> {
    assertSaveExternalUserAllowed(input);

    const user = await deps.userStore.saveExternalUser(input);

    return {
      user,
      publicUser: toPublicUser(user)
    };
  };
}
