import { createClient, type RedisClientType } from "redis";
import type { QueueRepositoryPort } from "../types/service.ts";

type Logger = {
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
  error(message: string, metadata?: unknown): void;
};

export class QueueRepository implements QueueRepositoryPort {
  private readonly client: RedisClientType;
  private stopped = false;

  constructor(redisUrl: string, private readonly logger: Logger) {
    this.client = createClient({ url: redisUrl });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  async pop(queueName: string, timeoutSeconds: number): Promise<string | null> {
    if (this.stopped) {
      return null;
    }

    const result = await this.client.brPop(queueName, timeoutSeconds);
    return result?.element ?? null;
  }

  async push(queueName: string, payload: string): Promise<void> {
    await this.client.lPush(queueName, payload);
  }
}
