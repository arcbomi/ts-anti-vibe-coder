import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { Pool } from "pg";
import type { GeneratedQuestion } from "../types/service.ts";

export class AnalysisJobRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async connect(): Promise<void> {
    const client = await this.pool.connect();
    client.release();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ensureSchema(): Promise<void> {
    const statements = [
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE TABLE IF NOT EXISTS repositories (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        gitea_repo_url TEXT NOT NULL,
        gitea_project_path TEXT NOT NULL DEFAULT '',
        default_branch TEXT NOT NULL DEFAULT 'main',
        bot_access_status TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
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
      `CREATE TABLE IF NOT EXISTS generated_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
        explanation TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        source_file_path TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_generated_questions_analysis_job_id ON generated_questions(analysis_job_id)`,
      `CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_job_id UUID NOT NULL,
        question TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
        explanation TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        source_file_path TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_questions_analysis_job_id ON questions(analysis_job_id)`
    ];

    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }

  async updateAnalysisJobStatus(jobId: string, status: string): Promise<void> {
    await this.pool.query(`UPDATE analysis_jobs SET status = $1 WHERE id = $2`, [status, jobId]);
  }

  async failAnalysisJob(jobId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.pool.query(
      `UPDATE analysis_jobs SET status = $1, error_code = $2, error_message = $3, completed_at = now() WHERE id = $4`,
      ["failed", errorCode, errorMessage, jobId]
    );
  }

  async completeAnalysisJob(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE analysis_jobs SET status = $1, error_code = NULL, error_message = NULL, completed_at = now() WHERE id = $2`,
      ["completed", jobId]
    );
  }

  async saveGeneratedQuestions(jobId: string, questions: GeneratedQuestion[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM generated_questions WHERE analysis_job_id = $1`, [jobId]);
      await client.query(`DELETE FROM questions WHERE analysis_job_id = $1`, [jobId]);

      for (const question of questions) {
        const values = [
          jobId,
          question.question,
          question.optionA,
          question.optionB,
          question.optionC,
          question.optionD,
          question.correctOption,
          question.explanation,
          question.difficulty,
          question.sourceFilePath
        ];

        await client.query(
          `INSERT INTO generated_questions (
            analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          values
        );
        await client.query(
          `INSERT INTO questions (
            analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          values
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new AppError("Failed to save generated questions.", {
        code: "DATABASE_ERROR",
        cause: error
      });
    } finally {
      client.release();
    }
  }
}
