import assert from "node:assert/strict";
import test from "node:test";
import { createEventBus } from "../src/index.js";

test("createEventBus exposes publish and serializes event value consistently", async () => {
  const sentMessages: Array<{
    topic: string;
    messages: Array<{ key: string; value: string }>;
  }> = [];

  const eventBus = createEventBus(
    {
      serviceName: "auth-service",
      kafkaBrokers: ["redpanda:9092"]
    },
    {
      async producerFactory() {
        return {
          async connect() {},
          async send(input) {
            sentMessages.push(input);
          }
        };
      }
    }
  );

  assert.equal(typeof eventBus.publish, "function");

  await eventBus.publish({
    topic: "auth.user.logged_in",
    key: "user-1",
    value: {
      userId: "user-1"
    }
  });

  assert.deepEqual(sentMessages, [
    {
      topic: "auth.user.logged_in",
      messages: [
        {
          key: "user-1",
          value: JSON.stringify({ userId: "user-1" })
        }
      ]
    }
  ]);
});
