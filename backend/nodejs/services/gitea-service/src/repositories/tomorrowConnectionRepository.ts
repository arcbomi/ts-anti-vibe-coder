import { Pool } from "pg";
import type { TomorrowConnection } from "../models/gitea.js";
import type { TomorrowConnectionStore } from "../types/service.js";

type TomorrowConnectionRow = {
  username: string;
  tomorrow_remote_token: string;
  tomorrow_profile_path: string;
};

export class PostgresTomorrowConnectionRepository implements TomorrowConnectionStore {
  pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async getTomorrowConnection(userId: string): Promise<TomorrowConnection | null> {
    const result = await this.pool.query<TomorrowConnectionRow>(
      `SELECT username, tomorrow_remote_token, tomorrow_profile_path
      FROM users
      WHERE id = $1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      username: row.username ?? "",
      remoteToken: row.tomorrow_remote_token ?? "",
      profilePath: row.tomorrow_profile_path ?? ""
    };
  }
}
