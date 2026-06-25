declare module "pg" {
  export type QueryResult<T = unknown> = {
    rows: T[];
    rowCount: number;
  };

  export class PoolClient {
    query<T = unknown>(queryText: string, values?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
  }

  export class Pool {
    constructor(config: { connectionString: string });
    query<T = unknown>(queryText: string, values?: unknown[]): Promise<QueryResult<T>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
