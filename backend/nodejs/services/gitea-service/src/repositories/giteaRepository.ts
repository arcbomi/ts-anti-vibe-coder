import { Pool } from "pg";
import type { AnalysisJobRecord, RepositoryRecord } from "../models/gitea.js";
import { toIsoString } from "../utils/strings.js";
import type { RepositoryStore } from "../types/service.js";

type RepositoryRow = {
  id: string;
  user_id: string;
  gitea_repo_url: string;
  gitea_project_path: string;
  tomorrow_audit_text: string;
  default_branch: string;
  bot_access_status: string;
  latest_analysis_job_id: string | null;
  latest_analysis_status: string | null;
  latest_analysis_error_message: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type AnalysisJobRow = {
  id: string;
  user_id: string;
  repository_id: string;
  status: string;
  error_message: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
};

function mapRepository(row: RepositoryRow): RepositoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    giteaRepoUrl: row.gitea_repo_url,
    giteaProjectPath: row.gitea_project_path,
    tomorrowAuditText: row.tomorrow_audit_text,
    defaultBranch: row.default_branch,
    botAccessStatus: row.bot_access_status as RepositoryRecord["botAccessStatus"],
    latestAnalysisJobId: row.latest_analysis_job_id,
    latestAnalysisStatus: row.latest_analysis_status,
    latestAnalysisErrorMessage: row.latest_analysis_error_message,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapAnalysisJob(row: AnalysisJobRow): AnalysisJobRecord {
  return {
    id: row.id,
    userId: row.user_id,
    repositoryId: row.repository_id,
    status: row.status as AnalysisJobRecord["status"],
    errorMessage: row.error_message,
    createdAt: toIsoString(row.created_at),
    completedAt: row.completed_at ? toIsoString(row.completed_at) : null
  };
}

export class PostgresGiteaRepository implements RepositoryStore {
  pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async ensureSchema() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS repositories (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        gitea_repo_url TEXT NOT NULL,
        gitea_project_path TEXT NOT NULL,
        tomorrow_audit_text TEXT NOT NULL DEFAULT '',
        default_branch TEXT NOT NULL DEFAULT 'main',
        bot_access_status TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'repositories'
            AND column_name = 'gitlab_repo_url'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'repositories'
            AND column_name = 'gitea_repo_url'
        ) THEN
          ALTER TABLE repositories RENAME COLUMN gitlab_repo_url TO gitea_repo_url;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'repositories'
            AND column_name = 'gitlab_project_path'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'repositories'
            AND column_name = 'gitea_project_path'
        ) THEN
          ALTER TABLE repositories RENAME COLUMN gitlab_project_path TO gitea_project_path;
        END IF;
      END $$`,
      `ALTER TABLE repositories ADD COLUMN IF NOT EXISTS tomorrow_audit_text TEXT NOT NULL DEFAULT ''`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_user_project ON repositories(user_id, gitea_project_path)`,
      `CREATE TABLE IF NOT EXISTS analysis_jobs (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      )`,
      `ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS error_code TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_analysis_jobs_repository_id ON analysis_jobs(repository_id)`
    ];

    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }

  async createRepository(input: {
    id: string;
    userId: string;
    giteaRepoUrl: string;
    giteaProjectPath: string;
    tomorrowAuditText?: string;
    defaultBranch?: string;
    botAccessStatus?: string;
  }) {
    const result = await this.pool.query<RepositoryRow>(
      `INSERT INTO repositories (
        id, user_id, gitea_repo_url, gitea_project_path, tomorrow_audit_text, default_branch, bot_access_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (user_id, gitea_project_path) DO UPDATE SET
        gitea_repo_url = EXCLUDED.gitea_repo_url,
        tomorrow_audit_text = EXCLUDED.tomorrow_audit_text,
        bot_access_status = 'unknown',
        updated_at = now()
      RETURNING
        id,
        user_id,
        gitea_repo_url,
        gitea_project_path,
        tomorrow_audit_text,
        default_branch,
        bot_access_status,
        NULL::TEXT AS latest_analysis_job_id,
        NULL::TEXT AS latest_analysis_status,
        NULL::TEXT AS latest_analysis_error_message,
        created_at,
        updated_at`,
      [
        input.id,
        input.userId,
        input.giteaRepoUrl,
        input.giteaProjectPath,
        input.tomorrowAuditText ?? "",
        input.defaultBranch ?? "main",
        input.botAccessStatus ?? "unknown"
      ]
    );

    return mapRepository(result.rows[0]);
  }

  async listRepositories(userId: string) {
    const result = await this.pool.query<RepositoryRow>(
      `SELECT
        r.id,
        r.user_id,
        r.gitea_repo_url,
        r.gitea_project_path,
        r.tomorrow_audit_text,
        r.default_branch,
        r.bot_access_status,
        (
          SELECT aj.id
          FROM analysis_jobs aj
          WHERE aj.repository_id = r.id
          ORDER BY aj.created_at DESC
          LIMIT 1
        ) AS latest_analysis_job_id,
        (
          SELECT aj.status
          FROM analysis_jobs aj
          WHERE aj.repository_id = r.id
          ORDER BY aj.created_at DESC
          LIMIT 1
        ) AS latest_analysis_status,
        (
          SELECT aj.error_message
          FROM analysis_jobs aj
          WHERE aj.repository_id = r.id
          ORDER BY aj.created_at DESC
          LIMIT 1
        ) AS latest_analysis_error_message,
        r.created_at,
        r.updated_at
      FROM repositories r
      WHERE r.user_id = $1
      ORDER BY r.updated_at DESC, r.created_at DESC`,
      [userId]
    );
    return result.rows.map(mapRepository);
  }

  async getRepository(userId: string, repositoryId: string) {
    const result = await this.pool.query<RepositoryRow>(
      `SELECT
        r.id,
        r.user_id,
        r.gitea_repo_url,
        r.gitea_project_path,
        r.tomorrow_audit_text,
        r.default_branch,
        r.bot_access_status,
        (
          SELECT aj.id
          FROM analysis_jobs aj
          WHERE aj.repository_id = r.id
          ORDER BY aj.created_at DESC
          LIMIT 1
        ) AS latest_analysis_job_id,
        (
          SELECT aj.status
          FROM analysis_jobs aj
          WHERE aj.repository_id = r.id
          ORDER BY aj.created_at DESC
          LIMIT 1
        ) AS latest_analysis_status,
        (
          SELECT aj.error_message
          FROM analysis_jobs aj
          WHERE aj.repository_id = r.id
          ORDER BY aj.created_at DESC
          LIMIT 1
        ) AS latest_analysis_error_message,
        r.created_at,
        r.updated_at
      FROM repositories r
      WHERE r.id = $1 AND r.user_id = $2`,
      [repositoryId, userId]
    );
    return result.rows[0] ? mapRepository(result.rows[0]) : null;
  }

  async updateBotAccess(input: {
    userId: string;
    repositoryId: string;
    status: string;
    defaultBranch?: string;
  }) {
    const result = await this.pool.query<RepositoryRow>(
      `UPDATE repositories
      SET bot_access_status = $1,
          default_branch = COALESCE(NULLIF($2, ''), default_branch),
          updated_at = now()
      WHERE id = $3 AND user_id = $4
      RETURNING
        id,
        user_id,
        gitea_repo_url,
        gitea_project_path,
        tomorrow_audit_text,
        default_branch,
        bot_access_status,
        NULL::TEXT AS latest_analysis_job_id,
        NULL::TEXT AS latest_analysis_status,
        NULL::TEXT AS latest_analysis_error_message,
        created_at,
        updated_at`,
      [input.status, input.defaultBranch ?? "", input.repositoryId, input.userId]
    );
    return result.rows[0] ? mapRepository(result.rows[0]) : null;
  }

  async createAnalysisJob(input: {
    id: string;
    userId: string;
    repositoryId: string;
    status: string;
    errorMessage?: string | null;
  }) {
    const result = await this.pool.query<AnalysisJobRow>(
      `INSERT INTO analysis_jobs (id, user_id, repository_id, status, error_message)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, user_id, repository_id, status, error_message, created_at, completed_at`,
      [input.id, input.userId, input.repositoryId, input.status, input.errorMessage ?? null]
    );
    return mapAnalysisJob(result.rows[0]);
  }

  async getAnalysisJob(userId: string, analysisJobId: string) {
    const result = await this.pool.query<AnalysisJobRow>(
      `SELECT id, user_id, repository_id, status, error_message, created_at, completed_at
      FROM analysis_jobs
      WHERE id = $1 AND user_id = $2`,
      [analysisJobId, userId]
    );
    return result.rows[0] ? mapAnalysisJob(result.rows[0]) : null;
  }

  async failAnalysisJob(userId: string, analysisJobId: string, message: string) {
    const result = await this.pool.query<{ id: string }>(
      `UPDATE analysis_jobs
      SET status = 'failed', error_message = $1, completed_at = now()
      WHERE id = $2 AND user_id = $3
      RETURNING id`,
      [message, analysisJobId, userId]
    );
    return result.rows.length > 0;
  }
}
