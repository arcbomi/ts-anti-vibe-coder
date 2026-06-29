import type { EventBus } from "@backend/microservice-sdk";
import type { TomorrowTokenStore } from "../loginUser/shared/TomorrowTokenStore.js";
import type { LogoutUserInput } from "./logoutUser.input.js";
import type { LogoutUserOutput } from "./logoutUser.output.js";

export function createLogoutUser(dependencies: {
  eventBus: EventBus;
  tomorrowTokenStore?: TomorrowTokenStore;
}) {
  return async function logoutUser(input: LogoutUserInput): Promise<LogoutUserOutput> {
    await dependencies.tomorrowTokenStore?.delete({
      userId: input.userId
    });

    await dependencies.eventBus.publish({
      topic: "auth.user.logged_out",
      key: input.userId,
      value: {
        userId: input.userId,
        occurredAt: new Date().toISOString()
      }
    });

    return {
      success: true
    };
  };
}
