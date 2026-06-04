package gitlab

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"backend/pkg/sdk/database"
)

type Store interface {
	EnsureSchema(ctx context.Context) error
	CreateRepository(ctx context.Context, repo *Repository) error
	GetRepository(ctx context.Context, userID string, repositoryID string) (*Repository, error)
	UpdateBotAccess(ctx context.Context, userID string, repositoryID string, status string, defaultBranch string) (*Repository, error)
	CreateAnalysisJob(ctx context.Context, job *AnalysisJob) error
	FailAnalysisJob(ctx context.Context, userID string, analysisJobID string, message string) error
	GetAnalysisJob(ctx context.Context, userID string, analysisJobID string) (*AnalysisJob, error)
}

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

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
		`CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_user_project ON repositories(user_id, gitlab_project_path)`,
		`CREATE TABLE IF NOT EXISTS analysis_jobs (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
			status TEXT NOT NULL DEFAULT 'pending',
			error_message TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			completed_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_analysis_jobs_repository_id ON analysis_jobs(repository_id)`,
	}
	for _, stmt := range statements {
		if _, err := s.db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostgresStore) CreateRepository(ctx context.Context, repo *Repository) error {
	if repo == nil {
		return fmt.Errorf("repository is required")
	}
	now := time.Now().UTC()
	if repo.CreatedAt.IsZero() {
		repo.CreatedAt = now
	}
	repo.UpdatedAt = now
	if repo.DefaultBranch == "" {
		repo.DefaultBranch = "main"
	}
	if repo.BotAccessStatus == "" {
		repo.BotAccessStatus = BotAccessUnknown
	}

	query := `INSERT INTO repositories (id, user_id, gitlab_repo_url, gitlab_project_path, default_branch, bot_access_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (user_id, gitlab_project_path) DO UPDATE SET
			gitlab_repo_url = EXCLUDED.gitlab_repo_url,
			bot_access_status = 'unknown',
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, gitlab_repo_url, gitlab_project_path, default_branch, bot_access_status, created_at, updated_at`
	return s.db.QueryRowContext(ctx, query, repo.ID, repo.UserID, repo.GitLabRepoURL, repo.GitLabProjectPath, repo.DefaultBranch, repo.BotAccessStatus, repo.CreatedAt, repo.UpdatedAt).Scan(
		&repo.ID, &repo.UserID, &repo.GitLabRepoURL, &repo.GitLabProjectPath, &repo.DefaultBranch, &repo.BotAccessStatus, &repo.CreatedAt, &repo.UpdatedAt,
	)
}

func (s *PostgresStore) GetRepository(ctx context.Context, userID string, repositoryID string) (*Repository, error) {
	query := `SELECT id, user_id, gitlab_repo_url, gitlab_project_path, default_branch, bot_access_status,
			(
				SELECT aj.id
				FROM analysis_jobs aj
				WHERE aj.repository_id = repositories.id
				ORDER BY aj.created_at DESC
				LIMIT 1
			) AS latest_analysis_job_id,
			created_at, updated_at
		FROM repositories WHERE id = $1 AND user_id = $2`
	repo := &Repository{}
	var latestAnalysisJobID sql.NullString
	if err := s.db.QueryRowContext(ctx, query, repositoryID, userID).Scan(
		&repo.ID, &repo.UserID, &repo.GitLabRepoURL, &repo.GitLabProjectPath, &repo.DefaultBranch, &repo.BotAccessStatus, &latestAnalysisJobID, &repo.CreatedAt, &repo.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if latestAnalysisJobID.Valid {
		repo.LatestAnalysisJobID = &latestAnalysisJobID.String
	}
	return repo, nil
}

func (s *PostgresStore) UpdateBotAccess(ctx context.Context, userID string, repositoryID string, status string, defaultBranch string) (*Repository, error) {
	if defaultBranch == "" {
		defaultBranch = "main"
	}
	query := `UPDATE repositories
		SET bot_access_status = $1, default_branch = COALESCE(NULLIF($2, ''), default_branch), updated_at = now()
		WHERE id = $3 AND user_id = $4
		RETURNING id, user_id, gitlab_repo_url, gitlab_project_path, default_branch, bot_access_status, created_at, updated_at`
	repo := &Repository{}
	if err := s.db.QueryRowContext(ctx, query, status, defaultBranch, repositoryID, userID).Scan(
		&repo.ID, &repo.UserID, &repo.GitLabRepoURL, &repo.GitLabProjectPath, &repo.DefaultBranch, &repo.BotAccessStatus, &repo.CreatedAt, &repo.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return repo, nil
}

func (s *PostgresStore) CreateAnalysisJob(ctx context.Context, job *AnalysisJob) error {
	if job == nil {
		return fmt.Errorf("analysis job is required")
	}
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now().UTC()
	}
	return database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		query := `INSERT INTO analysis_jobs (id, user_id, repository_id, status, error_message, created_at, completed_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, user_id, repository_id, status, error_message, created_at, completed_at`
		return tx.QueryRowContext(ctx, query, job.ID, job.UserID, job.RepositoryID, job.Status, job.ErrorMessage, job.CreatedAt, job.CompletedAt).Scan(
			&job.ID, &job.UserID, &job.RepositoryID, &job.Status, &job.ErrorMessage, &job.CreatedAt, &job.CompletedAt,
		)
	})
}

func (s *PostgresStore) GetAnalysisJob(ctx context.Context, userID string, analysisJobID string) (*AnalysisJob, error) {
	query := `SELECT id, user_id, repository_id, status, error_message, created_at, completed_at
		FROM analysis_jobs WHERE id = $1 AND user_id = $2`
	job := &AnalysisJob{}
	if err := s.db.QueryRowContext(ctx, query, analysisJobID, userID).Scan(
		&job.ID, &job.UserID, &job.RepositoryID, &job.Status, &job.ErrorMessage, &job.CreatedAt, &job.CompletedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return job, nil
}

func (s *PostgresStore) FailAnalysisJob(ctx context.Context, userID string, analysisJobID string, message string) error {
	result, err := s.db.ExecContext(
		ctx,
		`UPDATE analysis_jobs
		SET status = 'failed', error_message = $1, completed_at = now()
		WHERE id = $2 AND user_id = $3`,
		message,
		analysisJobID,
		userID,
	)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
