import type { EventBus, Logger, UserServiceClient } from "@backend/microservice-sdk";
import type { TomorrowServiceClient } from "./shared/TomorrowServiceClient.js";
import type { TomorrowTokenStore } from "./shared/TomorrowTokenStore.js";
import type { CurrentUser } from "../model/CurrentUser.js";
import type { AccessTokenIssuer } from "./createAccessToken.js";
import type { LoginUserInput } from "./loginUser.input.js";
import type { LoginUserOutput } from "./loginUser.output.js";
import { assertLoginInputAllowed } from "./loginUser.policy.js";

export function createLoginUser(dependencies: {
  tomorrowService: TomorrowServiceClient;
  userService: UserServiceClient;
  tomorrowTokenStore: TomorrowTokenStore;
  accessTokenIssuer: AccessTokenIssuer;
  eventBus: EventBus;
  logger?: Logger;
}) {
  return async function loginUser(input: LoginUserInput): Promise<LoginUserOutput> {
    assertLoginInputAllowed(input);

    const tomorrowToken = await dependencies.tomorrowService.authenticateTomorrowAccount({
      login: input.login,
      password: input.password
    });

    const tomorrowUser = await dependencies.tomorrowService.getTomorrowUserInformation({
      accessToken: tomorrowToken.accessToken
    });

    const user = await dependencies.userService.saveExternalUser({
      provider: "tomorrow",
      externalUserId: tomorrowUser.id,
      externalLogin: tomorrowUser.login,
      email: tomorrowUser.email,
      displayName: tomorrowUser.displayName
    });

    await dependencies.tomorrowTokenStore.save({
      userId: user.id,
      tomorrowUserId: tomorrowUser.id,
      tomorrowLogin: tomorrowUser.login,
      accessToken: tomorrowToken.accessToken,
      expiresAt: tomorrowToken.expiresAt
    });

    const accessToken = await dependencies.accessTokenIssuer.issue({
      userId: user.id
    });

    await dependencies.eventBus.publish({
      topic: "auth.user.logged_in",
      key: user.id,
      value: {
        userId: user.id,
        externalId: tomorrowUser.id,
        provider: "tomorrow",
        occurredAt: new Date().toISOString()
      }
    });

    dependencies.logger?.info("auth_login_succeeded", {
      userId: user.id
    });

    return {
      accessToken,
      user: toCurrentUser(user)
    };
  };
}

function toCurrentUser(user: Awaited<ReturnType<UserServiceClient["saveExternalUser"]>>): CurrentUser {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  };
}
