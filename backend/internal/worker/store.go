package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"backend/internal/analysis"
	"backend/pkg/sdk/database"
)

type GeneratedQuestion = analysis.GeneratedQuestion

type AnalysisStore interface {
	EnsureSchema(ctx context.Context) error
	UpdateAnalysisJobStatus(ctx context.Context, jobID, status string) error
	FailAnalysisJob(ctx context.Context, jobID, errorCode, errorMessage string) error
	CompleteAnalysisJob(ctx context.Context, jobID string) error
	SaveGeneratedQuestions(ctx context.Context, jobID string, questions []GeneratedQuestion) error
}

type PostgresStore struct{ db *sql.DB }

func NewPostgresStore(db *sql.DB) *PostgresStore { return &PostgresStore{db: db} }

func (s *PostgresStore) EnsureSchema(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS repositories (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			gitlab_repo_url TEXT NOT NULL,
			gitlab_project_path TEXT NOT NULL,
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
			error_message TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			completed_at TIMESTAMPTZ
		)`,
		`ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS error_code TEXT`,
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
		`CREATE INDEX IF NOT EXISTS idx_questions_analysis_job_id ON questions(analysis_job_id)`,
	}
	for _, stmt := range statements {
		if _, err := s.db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostgresStore) UpdateAnalysisJobStatus(ctx context.Context, jobID, status string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE analysis_jobs SET status = $1 WHERE id = $2`, status, jobID)
	return wrapDBErr(err)
}

func (s *PostgresStore) FailAnalysisJob(ctx context.Context, jobID, errorCode, errorMessage string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE analysis_jobs SET status = $1, error_code = $2, error_message = $3, completed_at = now() WHERE id = $4`, StatusFailed, errorCode, errorMessage, jobID)
	return wrapDBErr(err)
}

func (s *PostgresStore) CompleteAnalysisJob(ctx context.Context, jobID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE analysis_jobs SET status = $1, error_code = NULL, error_message = NULL, completed_at = now() WHERE id = $2`, StatusCompleted, jobID)
	return wrapDBErr(err)
}

func (s *PostgresStore) SaveGeneratedQuestions(ctx context.Context, jobID string, questions []GeneratedQuestion) error {
	return wrapDBErr(database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM generated_questions WHERE analysis_job_id = $1`, jobID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM questions WHERE analysis_job_id = $1`, jobID); err != nil {
			return err
		}
		generatedStmt := `INSERT INTO generated_questions (analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
		questionStmt := `INSERT INTO questions (analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
		for _, q := range questions {
			if _, err := json.Marshal(q); err != nil {
				return fmt.Errorf("question contains invalid JSON data: %w", err)
			}
			args := []any{jobID, q.Question, q.OptionA, q.OptionB, q.OptionC, q.OptionD, q.CorrectOption, q.Explanation, q.Difficulty, q.SourceFilePath}
			if _, err := tx.ExecContext(ctx, generatedStmt, args...); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, questionStmt, args...); err != nil {
				return err
			}
		}
		return nil
	}))
}

func wrapDBErr(err error) error {
	if err == nil {
		return nil
	}
	return NewRetryableError(ErrCodeDatabase, err.Error(), err)
}
