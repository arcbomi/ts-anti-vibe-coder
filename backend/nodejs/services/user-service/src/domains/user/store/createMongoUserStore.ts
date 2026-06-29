import { randomUUID } from "node:crypto";
import { AppError } from "@backend/microservice-sdk";
import type { User } from "../model/User.js";
import type { UserStore } from "./UserStore.js";

type MongoCollection = {
  createIndex(keys: Record<string, 1 | -1>, options?: Record<string, unknown>): Promise<unknown>;
  findOne(query: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  insertOne(document: Record<string, unknown>): Promise<unknown>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
};

type MongoDb = {
  collection(name: string): MongoCollection;
};

type MongoClientLike = {
  connect(): Promise<void>;
  db(name: string): MongoDb;
};

type MongoModule = {
  MongoClient: new (uri: string) => MongoClientLike;
};

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

export function createMongoUserStore(input: {
  config: {
    mongodbUri?: string;
    mongodbDatabase?: string;
  };
}): UserStore {
  const uri = String(input.config.mongodbUri ?? "").trim();
  const databaseName = String(input.config.mongodbDatabase ?? "").trim();

  if (!uri || !databaseName) {
    throw new AppError("MongoDB configuration is required.", {
      statusCode: 500,
      code: "CONFIGURATION_ERROR"
    });
  }

  let clientPromise: Promise<MongoClientLike> | null = null;
  let collectionPromise: Promise<MongoCollection> | null = null;

  async function getCollection() {
    collectionPromise ??= (async () => {
      const client = await getClient();
      return client.db(databaseName).collection("users");
    })();

    return collectionPromise;
  }

  async function getClient() {
    clientPromise ??= (async () => {
      const mongodb = (await import("mongodb")) as MongoModule;
      const client = await connectMongoClientWithRetry(
        async () => {
          const nextClient = new mongodb.MongoClient(uri);
          await nextClient.connect();
          return nextClient;
        },
        {
          attempts: 10,
          delayMs: 1_000
        }
      );
      return client;
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });

    return clientPromise;
  }

  return {
    async ensureSchema() {
      const collection = await getCollection();
      await collection.createIndex({ id: 1 }, { unique: true, name: "users_id_unique" });
      await collection.createIndex({ email: 1 }, { unique: true, sparse: true, name: "users_email_unique" });
      await collection.createIndex({ username: 1 }, { unique: true, sparse: true, name: "users_username_unique" });
      await collection.createIndex(
        {
          "externalIdentities.provider": 1,
          "externalIdentities.externalUserId": 1
        },
        {
          unique: true,
          name: "users_external_identity_unique"
        }
      );
    },
    async saveExternalUser(rawInput) {
      const collection = await getCollection();
      const externalUserId = rawInput.externalUserId.trim();
      const externalLogin = rawInput.externalLogin.trim();
      const now = new Date().toISOString();

      try {
        const existing = await collection.findOne({
          externalIdentities: {
            $elemMatch: {
              provider: rawInput.provider,
              externalUserId
            }
          }
        });

        if (existing) {
          await collection.updateOne(
            { id: readString(existing.id) },
            {
              $set: {
                email: rawInput.email?.trim() || undefined,
                login: externalLogin,
                username: externalLogin,
                displayName: rawInput.displayName?.trim() || undefined,
                externalIdentities: [
                  {
                    provider: rawInput.provider,
                    externalUserId,
                    externalLogin
                  }
                ],
                updatedAt: now
              }
            }
          );

          return mapUser({
            ...existing,
            email: rawInput.email?.trim() || undefined,
            login: externalLogin,
            username: externalLogin,
            displayName: rawInput.displayName?.trim() || undefined,
            externalIdentities: [
              {
                provider: rawInput.provider,
                externalUserId,
                externalLogin
              }
            ],
            updatedAt: now
          });
        }

        const created = {
          id: randomUUID(),
          email: rawInput.email?.trim() || undefined,
          login: externalLogin,
          username: externalLogin,
          displayName: rawInput.displayName?.trim() || undefined,
          externalIdentities: [
            {
              provider: rawInput.provider,
              externalUserId,
              externalLogin
            }
          ],
          createdAt: now,
          updatedAt: now
        };

        await collection.insertOne(created);
        return mapUser(created);
      } catch (error) {
        throw toUserStoreError(error);
      }
    },
    async findById(input) {
      const collection = await getCollection();

      try {
        const document = await collection.findOne({
          id: input.userId.trim()
        });

        return document ? mapUser(document) : null;
      } catch (error) {
        throw toUserStoreError(error);
      }
    },
    async findByExternalIdentity(input) {
      const collection = await getCollection();

      try {
        const document = await collection.findOne({
          externalIdentities: {
            $elemMatch: {
              provider: input.provider,
              externalUserId: input.externalUserId.trim()
            }
          }
        });

        return document ? mapUser(document) : null;
      } catch (error) {
        throw toUserStoreError(error);
      }
    }
  };
}

function mapUser(document: Record<string, unknown>): User {
  const externalIdentities = Array.isArray(document.externalIdentities) ? document.externalIdentities : [];

  return {
    id: readString(document.id),
    email: readOptionalString(document.email),
    login: readOptionalString(document.login),
    username: readOptionalString(document.username),
    displayName: readOptionalString(document.displayName),
    externalIdentities: externalIdentities
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const identity = item as Record<string, unknown>;
        const provider = readString(identity.provider);
        const externalUserId = readString(identity.externalUserId);
        const externalLogin = readString(identity.externalLogin);

        if (provider !== "tomorrow" || !externalUserId || !externalLogin) {
          return null;
        }

        return {
          provider: "tomorrow" as const,
          externalUserId,
          externalLogin
        };
      })
      .filter((identity): identity is User["externalIdentities"][number] => identity !== null),
    createdAt: readString(document.createdAt),
    updatedAt: readString(document.updatedAt)
  };
}

function toUserStoreError(error: unknown) {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === 11000) {
    return new AppError("User identity already exists.", {
      statusCode: 409,
      code: "CONFLICT"
    });
  }

  return new AppError("User store operation failed.", {
    statusCode: 500,
    code: "USER_STORE_FAILED"
  });
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const normalized = readString(value);
  return normalized || undefined;
}

export async function connectMongoClientWithRetry<T>(
  connect: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 10);
  const delayMs = Math.max(0, options.delayMs ?? 1_000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await connect();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableMongoConnectionError(error)) {
        throw error;
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

function isRetryableMongoConnectionError(error: unknown) {
  if (hasRetryableNetworkCode(error)) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (hasRetryableNetworkCode(cause)) {
    return true;
  }

  const reason = (error as { reason?: { servers?: unknown } }).reason;
  if (!(reason?.servers instanceof Map)) {
    return false;
  }

  return Array.from(reason.servers.values()).some((server) =>
    hasRetryableNetworkCode((server as { error?: unknown } | null)?.error)
  );
}

function hasRetryableNetworkCode(error: unknown) {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "EHOSTUNREACH";
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
