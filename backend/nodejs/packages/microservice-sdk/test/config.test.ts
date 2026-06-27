import assert from "node:assert/strict";
import test from "node:test";
import { AppError, loadConfig } from "../src/index.js";

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("loadConfig reads required env", () => {
  process.env.JWT_SECRET = "secret";
  process.env.KAFKA_BROKERS = "redpanda:9092,localhost:19092";
  process.env.AUTH_SERVICE_PORT = "3005";

  const config = loadConfig("auth-service");

  assert.equal(config.serviceName, "auth-service");
  assert.equal(config.port, 3005);
  assert.deepEqual(config.kafkaBrokers, ["redpanda:9092", "localhost:19092"]);
  assert.equal(config.jwtSecret, "secret");
});

test("loadConfig throws on missing required env", () => {
  delete process.env.JWT_SECRET;

  assert.throws(() => loadConfig("auth-service"), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "CONFIGURATION_ERROR");
    return true;
  });
});
