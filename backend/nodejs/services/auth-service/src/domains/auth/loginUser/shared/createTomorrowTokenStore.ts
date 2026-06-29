import type { AppConfig } from "@backend/microservice-sdk";
import { AppError } from "@backend/microservice-sdk";
import type { TomorrowTokenStore } from "./TomorrowTokenStore.js";

type RedisClientLike = {
  connect(): Promise<void>;
  set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

type RedisModule = {
  createClient(input: { url: string }): RedisClientLike;
};

export function createTomorrowTokenStore(
  config: Pick<AppConfig, "redisUrl" | "tomorrowJwtTtlSeconds">,
  input: {
    now?: () => string;
  } = {}
): TomorrowTokenStore {
  const redisUrl = String(config.redisUrl ?? "").trim();
  if (!redisUrl) {
    throw new AppError("redisUrl is required.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  const now = input.now ?? (() => new Date().toISOString());
  let clientPromise: Promise<RedisClientLike> | null = null;

  async function getClient() {
    clientPromise ??= (async () => {
      const redis = (await import("redis")) as RedisModule;
      const client = redis.createClient({ url: redisUrl });
      await client.connect();
      return client;
    })();

    return clientPromise;
  }

  return {
    async save(token) {
      const client = await getClient();
      const ttlSeconds = resolveTtlSeconds(token.expiresAt, config.tomorrowJwtTtlSeconds);
      await client.set(
        toTomorrowJwtRedisKey(token.userId),
        JSON.stringify({
          userId: token.userId,
          tomorrowUserId: token.tomorrowUserId,
          tomorrowLogin: token.tomorrowLogin,
          accessToken: token.accessToken,
          savedAt: now(),
          expiresAt: token.expiresAt
        }),
        ttlSeconds ? { EX: ttlSeconds } : undefined
      );
    },
    async delete(input) {
      const client = await getClient();
      await client.del(toTomorrowJwtRedisKey(input.userId));
    }
  };
}

function resolveTtlSeconds(expiresAt: string | undefined, fallbackTtlSeconds = 60 * 60 * 24) {
  if (!expiresAt) {
    return fallbackTtlSeconds;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return fallbackTtlSeconds;
  }

  const ttlSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);
  return ttlSeconds > 0 ? ttlSeconds : fallbackTtlSeconds;
}

export function toTomorrowJwtRedisKey(userId: string) {
  return `tomorrow:jwt:user:${userId}`;
}
