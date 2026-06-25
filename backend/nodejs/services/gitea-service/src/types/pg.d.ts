declare module "pg" {
  export class Pool {
    constructor(config: { connectionString: string });
    query<T = unknown>(queryText: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
  }
}
