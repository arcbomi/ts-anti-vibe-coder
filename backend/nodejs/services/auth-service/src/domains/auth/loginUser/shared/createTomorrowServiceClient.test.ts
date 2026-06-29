import assert from "node:assert/strict";
import test from "node:test";
import { createTomorrowServiceClient } from "./createTomorrowServiceClient.js";

test("getTomorrowUserInformation forwards the access token as an Authorization header", async () => {
  const calls: Array<RequestInit | undefined> = [];
  const client = createTomorrowServiceClient(
    {
      tomorrowServiceBaseUrl: "http://tomorrow-service.test",
      tomorrowServiceTimeoutMs: 5000
    },
    async (_input, init) => {
      calls.push(init);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            user: {
              id: "42",
              login: "student"
            }
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  );

  const user = await client.getTomorrowUserInformation({
    accessToken: "tomorrow-token"
  });

  assert.equal(user.id, "42");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.headers, {
    Accept: "application/json",
    Authorization: "Bearer tomorrow-token"
  });
});
