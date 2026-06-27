import assert from "node:assert/strict";
import test from "node:test";
import { proxyRequest } from "./proxyRequest.js";

test("forwards method and body", async () => {
  let seenMethod = "";
  let seenBody = "";

  const result = await proxyRequest({
    method: "POST",
    upstreamUrl: "http://upstream.test/repositories",
    headers: {
      "content-type": "application/json"
    },
    body: { hello: "world" },
    fetchImpl: async (_input, init) => {
      seenMethod = init?.method ?? "";
      seenBody = String(init?.body);

      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  assert.equal(seenMethod, "POST");
  assert.equal(seenBody, JSON.stringify({ hello: "world" }));
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.headers, {
    "content-type": "application/json"
  });
  assert.equal(result.body.toString("utf8"), JSON.stringify({ ok: true }));
});

test("strips hop-by-hop headers", async () => {
  let forwardedHeaders = new Headers();

  await proxyRequest({
    method: "GET",
    upstreamUrl: "http://upstream.test/repositories",
    headers: {
      authorization: "Bearer token",
      host: "gateway.test",
      connection: "keep-alive",
      "x-request-id": "req-1"
    },
    authenticatedUserId: "user-1",
    fetchImpl: async (_input, init) => {
      forwardedHeaders = new Headers(init?.headers);
      return new Response("ok", {
        status: 200
      });
    }
  });

  assert.equal(forwardedHeaders.get("authorization"), "Bearer token");
  assert.equal(forwardedHeaders.get("host"), null);
  assert.equal(forwardedHeaders.get("connection"), null);
  assert.equal(forwardedHeaders.get("x-request-id"), "req-1");
  assert.equal(forwardedHeaders.get("x-user-id"), "user-1");
  assert.equal(forwardedHeaders.get("x-authenticated"), "true");
});

test("returns upstream status and body", async () => {
  const result = await proxyRequest({
    method: "GET",
    upstreamUrl: "http://upstream.test/exams/exam-1",
    headers: {},
    fetchImpl: async () =>
      new Response("upstream body", {
        status: 202,
        headers: {
          "content-type": "text/plain",
          "access-control-allow-origin": "http://upstream.test",
          connection: "keep-alive"
        }
      })
  });

  assert.equal(result.statusCode, 202);
  assert.deepEqual(result.headers, {
    "content-type": "text/plain"
  });
  assert.equal(result.body.toString("utf8"), "upstream body");
});
