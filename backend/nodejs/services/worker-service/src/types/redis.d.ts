declare module "redis" {
  export type RedisClientType = {
    isOpen: boolean;
    connect(): Promise<void>;
    quit(): Promise<void>;
    brPop(queueName: string, timeoutSeconds: number): Promise<{ key: string; element: string } | null>;
    lPush(queueName: string, payload: string): Promise<number>;
  };

  export function createClient(input: { url: string }): RedisClientType;
}
