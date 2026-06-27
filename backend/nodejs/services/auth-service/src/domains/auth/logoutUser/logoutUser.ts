import type { EventBus } from "@backend/microservice-sdk";
import type { LogoutUserInput } from "./logoutUser.input.js";
import type { LogoutUserOutput } from "./logoutUser.output.js";

export function createLogoutUser(dependencies: {
  eventBus: EventBus;
}) {
  return async function logoutUser(input: LogoutUserInput): Promise<LogoutUserOutput> {
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
