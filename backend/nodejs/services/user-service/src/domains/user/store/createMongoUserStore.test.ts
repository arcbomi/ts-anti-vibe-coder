import assert from "node:assert/strict";
import test from "node:test";
import { connectMongoClientWithRetry } from "./createMongoUserStore.js";

test("connectMongoClientWithRetry retries retryable Mongo connection failures", async () => {
  let attempts = 0;

  const result = await connectMongoClientWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("connect ECONNREFUSED");
        (error as Error & { code: string }).code = "ECONNREFUSED";
        throw error;
      }

      return "connected";
    },
    {
      attempts: 3,
      delayMs: 0
    }
  );

  assert.equal(result, "connected");
  assert.equal(attempts, 3);
});

test("connectMongoClientWithRetry does not retry non-network failures", async () => {
  const error = new Error("duplicate key");
  (error as Error & { code: number }).code = 11000;
  let attempts = 0;

  await assert.rejects(
    () =>
      connectMongoClientWithRetry(
        async () => {
          attempts += 1;
          throw error;
        },
        {
          attempts: 5,
          delayMs: 0
        }
      ),
    error
  );

  assert.equal(attempts, 1);
});

test("connectMongoClientWithRetry retries Mongo driver server selection network failures", async () => {
  let attempts = 0;

  const result = await connectMongoClientWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 2) {
        const networkError = new Error("connect ECONNREFUSED");
        (networkError as Error & { code: string }).code = "ECONNREFUSED";

        const error = new Error("server selection failed") as Error & {
          reason: {
            servers: Map<string, { error: Error & { code: string } }>;
          };
        };
        error.reason = {
          servers: new Map([["mongodb:27017", { error: networkError as Error & { code: string } }]])
        };
        throw error;
      }

      return "connected";
    },
    {
      attempts: 2,
      delayMs: 0
    }
  );

  assert.equal(result, "connected");
  assert.equal(attempts, 2);
});
