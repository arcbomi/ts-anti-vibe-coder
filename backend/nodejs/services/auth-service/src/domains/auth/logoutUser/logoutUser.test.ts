import assert from "node:assert/strict";
import test from "node:test";
import { createMockEventBus } from "@backend/microservice-sdk";
import { createLogoutUser } from "./logoutUser.js";

test("logoutUser publishes auth.user.logged_out and returns success", async () => {
  const eventBus = createMockEventBus();
  const logoutUser = createLogoutUser({
    eventBus
  });

  const result = await logoutUser({
    userId: "user-1"
  });

  assert.equal(result.success, true);
  assert.equal(eventBus.publishedEvents[0]?.topic, "auth.user.logged_out");
  assert.equal(eventBus.publishedEvents[0]?.key, "user-1");
});
