import type {
  EventBus,
  Logger,
  TomorrowSchoolAuthClient,
  UserServiceClient
} from "@backend/microservice-sdk";
import type { CurrentUser } from "../model/CurrentUser.js";
import type { AccessTokenIssuer } from "./createAccessToken.js";
import type { LoginUserInput } from "./loginUser.input.js";
import type { LoginUserOutput } from "./loginUser.output.js";
import { assertLoginInputAllowed } from "./loginUser.policy.js";

export function createLoginUser(dependencies: {
  tomorrowSchoolAuth: TomorrowSchoolAuthClient;
  userService: UserServiceClient;
  accessTokenIssuer: AccessTokenIssuer;
  eventBus: EventBus;
  logger?: Logger;
}) {
  return async function loginUser(input: LoginUserInput): Promise<LoginUserOutput> {
    assertLoginInputAllowed(input);

    const externalUser = await dependencies.tomorrowSchoolAuth.login({
      login: input.login,
      password: input.password
    });

    const user = await dependencies.userService.findOrCreateFromExternalUser({
      provider: "tomorrow_school",
      externalId: externalUser.externalId,
      login: externalUser.login,
      email: externalUser.email,
      displayName: externalUser.displayName,
      avatarUrl: externalUser.avatarUrl
    });

    const accessToken = await dependencies.accessTokenIssuer.issue({
      userId: user.id
    });

    await dependencies.eventBus.publish({
      topic: "auth.user.logged_in",
      key: user.id,
      value: {
        userId: user.id,
        externalId: externalUser.externalId,
        provider: "tomorrow_school",
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

function toCurrentUser(user: Awaited<ReturnType<UserServiceClient["findOrCreateFromExternalUser"]>>): CurrentUser {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  };
}
