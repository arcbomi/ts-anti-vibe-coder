import { Pool } from "pg";
import type { UpdateUserProfileRequest, UserRecord, UserRepository } from "../types/user.js";

type UserRow = {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  tomorrow_login_credential: string;
  tomorrow_login_password: string;
  password_hash: string;
  auth_provider: "local" | "tomorrow-school";
  tomorrow_remote_token: string;
  tomorrow_profile_path: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    loginCredential: row.tomorrow_login_credential,
    loginPassword: row.tomorrow_login_password,
    passwordHash: row.password_hash,
    authProvider: row.auth_provider,
    remoteToken: row.tomorrow_remote_token,
    profilePath: row.tomorrow_profile_path,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

export class PostgresUserRepository implements UserRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async ensureSchema() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        username TEXT NOT NULL DEFAULT '',
        tomorrow_login_credential TEXT NOT NULL DEFAULT '',
        tomorrow_login_password TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT '',
        auth_provider TEXT NOT NULL DEFAULT 'local',
        tomorrow_remote_token TEXT NOT NULL DEFAULT '',
        tomorrow_profile_path TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_login_credential TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_login_password TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_remote_token TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_profile_path TEXT NOT NULL DEFAULT ''`
    ];

    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }

  async createUser(user: UserRecord) {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (
        id, email, name, first_name, last_name, username, tomorrow_login_credential,
        tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        user.id,
        user.email,
        user.name,
        user.firstName,
        user.lastName,
        user.username,
        user.loginCredential,
        user.loginPassword,
        user.passwordHash,
        user.authProvider,
        user.remoteToken,
        user.profilePath
      ]
    );

    return mapUser(result.rows[0]);
  }

  async getUserByEmail(email: string) {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async getUserById(id: string) {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async getUserByUsername(username: string) {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE username = $1", [username]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async updateUserForDevSeed(user: UserRecord) {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET name = $2, first_name = $3, last_name = $4, username = $5,
           tomorrow_login_credential = $6, tomorrow_login_password = $7, password_hash = $8,
           auth_provider = $9, tomorrow_remote_token = $10, tomorrow_profile_path = $11, updated_at = now()
       WHERE email = $1
       RETURNING *`,
      [
        user.email,
        user.name,
        user.firstName,
        user.lastName,
        user.username,
        user.loginCredential,
        user.loginPassword,
        user.passwordHash,
        user.authProvider,
        user.remoteToken,
        user.profilePath
      ]
    );

    return result.rows[0] ? mapUser(result.rows[0]) : user;
  }

  async upsertExternalUser(user: UserRecord) {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (
        id, email, name, first_name, last_name, username, tomorrow_login_credential,
        tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        username = EXCLUDED.username,
        tomorrow_login_credential = EXCLUDED.tomorrow_login_credential,
        tomorrow_login_password = EXCLUDED.tomorrow_login_password,
        auth_provider = EXCLUDED.auth_provider,
        tomorrow_remote_token = EXCLUDED.tomorrow_remote_token,
        tomorrow_profile_path = EXCLUDED.tomorrow_profile_path,
        updated_at = now()
      RETURNING *`,
      [
        user.id,
        user.email,
        user.name,
        user.firstName,
        user.lastName,
        user.username,
        user.loginCredential,
        user.loginPassword,
        user.passwordHash,
        user.authProvider,
        user.remoteToken,
        user.profilePath
      ]
    );

    return mapUser(result.rows[0]);
  }

  async updateUserProfile(id: string, updates: UpdateUserProfileRequest) {
    const existing = await this.getUserById(id);
    if (!existing) {
      return null;
    }

    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET name = $2, first_name = $3, last_name = $4, username = $5, tomorrow_profile_path = $6, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        updates.name ?? existing.name,
        updates.firstName ?? existing.firstName,
        updates.lastName ?? existing.lastName,
        updates.username ?? existing.username,
        updates.profilePath ?? existing.profilePath
      ]
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
}
