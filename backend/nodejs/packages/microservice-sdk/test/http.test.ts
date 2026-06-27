import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import {
  BadRequestError,
  UnauthorizedError,
  registerErrorHandler,
  sendSuccess
} from "../src/index.js";

test("BadRequestError maps to 400", async () => {
  const app = Fastify();
  registerErrorHandler(app, { appEnv: "development" });
  app.get("/", async () => {
    throw new BadRequestError("bad request");
  });

  const response = await app.inject({ method: "GET", url: "/" });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    success: false,
    data: null,
    error: {
      code: "BAD_REQUEST",
      message: "bad request"
    }
  });
});

test("UnauthorizedError maps to 401", async () => {
  const app = Fastify();
  registerErrorHandler(app, { appEnv: "development" });
  app.get("/", async () => {
    throw new UnauthorizedError("nope");
  });

  const response = await app.inject({ method: "GET", url: "/" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHORIZED");
});

test("errorHandler maps unknown errors to 500", async () => {
  const app = Fastify();
  registerErrorHandler(app, { appEnv: "production" });
  app.get("/", async () => {
    throw new Error("boom");
  });

  const response = await app.inject({ method: "GET", url: "/" });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    success: false,
    data: null,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error."
    }
  });
});

test("sendSuccess returns consistent success shape", async () => {
  const app = Fastify();
  app.get("/", async (_request, reply) => sendSuccess(reply, { ok: true }, 201));

  const response = await app.inject({ method: "GET", url: "/" });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    success: true,
    data: { ok: true }
  });
});
