package exam

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	"backend/pkg/sdk/database"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type Store interface {
	EnsureSchema(ctx context.Context) error
	VerifyAnalysisJobOwnership(ctx context.Context, userID string, repositoryID string, analysisJobID string) error
	GetAnalysisJobRepositoryID(ctx context.Context, userID string, analysisJobID string) (string, error)
	GetGeneratedQuestions(ctx context.Context, analysisJobID string, limit int) ([]Question, error)
	UpdateRepositoryAnalysisJobStatus(ctx context.Context, analysisJobID, status string) error
	CompleteRepositoryAnalysisJob(ctx context.Context, analysisJobID string) error
	SaveGeneratedQuestions(ctx context.Context, analysisJobID string, questions []Question) error
	CreateExamWithQuestions(ctx context.Context, exam Exam, questions []Question) (Exam, error)
	GetExam(ctx context.Context, userID string, examID string) (Exam, error)
	GetExamQuestions(ctx context.Context, examID string) ([]Question, error)
	SaveSubmission(ctx context.Context, examID string, answers []Answer, score int, passed bool, submittedAt time.Time) error
	GetResultAnswers(ctx context.Context, examID string) ([]ResultAnswer, error)
	CreatePreparationJob(ctx context.Context, job PreparationJob) (PreparationJob, error)
	MarkPreparationJobDownloading(ctx context.Context, jobID string) error
	CompletePreparationJob(ctx context.Context, jobID, localPath, commitHash string, completedAt time.Time) error
	FailPreparationJob(ctx context.Context, jobID, errorMessage string, completedAt time.Time) error
	GetTomorrowConnection(ctx context.Context, userID string) (TomorrowConnection, error)
	ListPreparationJobs(ctx context.Context, userID string) ([]PreparationJob, error)
	UpsertSucceededProjectRepository(ctx context.Context, userID, repoURL, auditText string) (SucceededProjectRepositoryRecord, error)
	ListSucceededProjectRepositories(ctx context.Context, userID string) ([]SucceededProjectRepositoryRecord, error)
	CreateRepositoryAnalysisJob(ctx context.Context, userID, repositoryID string) (RepositoryAnalysisJobRecord, error)
	FailRepositoryAnalysisJob(ctx context.Context, analysisJobID, errorMessage string) error
	ListUserExams(ctx context.Context, userID string) ([]Exam, error)
}

type SucceededProjectRepositoryRecord struct {
	RepositoryID               string
	RepoURL                    string
	ProjectPath                string
	AuditText                  string
	DefaultBranch              string
	LatestAnalysisJobID        string
	LatestAnalysisStatus       string
	LatestAnalysisErrorMessage string
}

type RepositoryAnalysisJobRecord struct {
	ID           string
	UserID       string
	RepositoryID string
	Status       string
	CreatedAt    time.Time
}

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) EnsureSchema(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS questions (
			id UUID PRIMARY KEY,
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
		`CREATE TABLE IF NOT EXISTS exams (
			id UUID PRIMARY KEY,
			user_id UUID,
			repository_id UUID,
			analysis_job_id UUID NOT NULL,
			scheduled_at TIMESTAMPTZ,
			status TEXT NOT NULL DEFAULT 'scheduled',
			score INTEGER,
			passed BOOLEAN,
			passing_score INTEGER NOT NULL DEFAULT 70,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			submitted_at TIMESTAMPTZ
		)`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS user_id UUID`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS repository_id UUID`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS score INTEGER`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS passed BOOLEAN`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS passing_score INTEGER NOT NULL DEFAULT 70`,
		`ALTER TABLE exams ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_exams_analysis_job_id ON exams(analysis_job_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exams_repository_id ON exams(repository_id)`,
		`CREATE TABLE IF NOT EXISTS exam_questions (
			id UUID PRIMARY KEY,
			exam_id UUID NOT NULL,
			question_id UUID NOT NULL,
			order_index INTEGER NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (exam_id, question_id),
			UNIQUE (exam_id, order_index)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON exam_questions(exam_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exam_questions_question_id ON exam_questions(question_id)`,
		`CREATE TABLE IF NOT EXISTS exam_answers (
			id UUID PRIMARY KEY,
			exam_id UUID NOT NULL,
			question_id UUID NOT NULL,
			selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
			is_correct BOOLEAN NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (exam_id, question_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_exam_answers_exam_id ON exam_answers(exam_id)`,
		`CREATE TABLE IF NOT EXISTS preparation_jobs (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			project_slug TEXT NOT NULL,
			repo_url TEXT NOT NULL,
			attempt_id UUID NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			local_path TEXT,
			commit_hash TEXT,
			error_message TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			completed_at TIMESTAMPTZ,
			UNIQUE (user_id, attempt_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_preparation_jobs_user_id ON preparation_jobs(user_id)`,
	}
	for _, stmt := range statements {
		if _, err := s.db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostgresStore) GetGeneratedQuestions(ctx context.Context, analysisJobID string, limit int) ([]Question, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path, created_at, 0 AS order_index
		FROM questions WHERE analysis_job_id = $1 ORDER BY created_at ASC, id ASC LIMIT $2`, analysisJobID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanQuestions(rows)
}

func (s *PostgresStore) UpdateRepositoryAnalysisJobStatus(ctx context.Context, analysisJobID, status string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE analysis_jobs SET status = $2 WHERE id = $1`, analysisJobID, strings.TrimSpace(status))
	return err
}

func (s *PostgresStore) CompleteRepositoryAnalysisJob(ctx context.Context, analysisJobID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE analysis_jobs SET status = 'completed', error_message = NULL, completed_at = now() WHERE id = $1`, analysisJobID)
	return err
}

func (s *PostgresStore) SaveGeneratedQuestions(ctx context.Context, analysisJobID string, questions []Question) error {
	return database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM generated_questions WHERE analysis_job_id = $1`, analysisJobID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM questions WHERE analysis_job_id = $1`, analysisJobID); err != nil {
			return err
		}

		generatedStmt := `INSERT INTO generated_questions (analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`
		questionStmt := `INSERT INTO questions (id, analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`

		for i := range questions {
			q := questions[i]
			if q.ID == "" {
				q.ID = uuid.NewString()
			}
			if q.CreatedAt.IsZero() {
				q.CreatedAt = time.Now().UTC()
			}
			args := []any{analysisJobID, q.Question, q.OptionA, q.OptionB, q.OptionC, q.OptionD, q.CorrectOption, q.Explanation, q.Difficulty, q.SourceFilePath}
			if _, err := tx.ExecContext(ctx, generatedStmt, args...); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, questionStmt, q.ID, analysisJobID, q.Question, q.OptionA, q.OptionB, q.OptionC, q.OptionD, q.CorrectOption, q.Explanation, q.Difficulty, q.SourceFilePath, q.CreatedAt); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PostgresStore) VerifyAnalysisJobOwnership(ctx context.Context, userID string, repositoryID string, analysisJobID string) error {
	var exists bool
	err := s.db.QueryRowContext(ctx, `SELECT EXISTS(
		SELECT 1 FROM analysis_jobs
		WHERE id = $1 AND user_id = $2 AND repository_id = $3
	)`, analysisJobID, userID, repositoryID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return nil
}

func (s *PostgresStore) GetAnalysisJobRepositoryID(ctx context.Context, userID string, analysisJobID string) (string, error) {
	var repositoryID string
	err := s.db.QueryRowContext(ctx, `SELECT repository_id::text FROM analysis_jobs WHERE id = $1 AND user_id = $2`, analysisJobID, userID).Scan(&repositoryID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return repositoryID, nil
}

func (s *PostgresStore) CreateExamWithQuestions(ctx context.Context, e Exam, questions []Question) (Exam, error) {
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	if e.Status == "" {
		e.Status = StatusScheduled
	}
	return e, database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO exams (id, user_id, repository_id, analysis_job_id, scheduled_at, status, passing_score, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, e.ID, e.UserID, e.RepositoryID, e.AnalysisJobID, e.ScheduledAt, e.Status, e.PassingScore, e.CreatedAt)
		if err != nil {
			return err
		}
		for i, q := range questions {
			_, err := tx.ExecContext(ctx, `INSERT INTO exam_questions (id, exam_id, question_id, order_index, created_at) VALUES ($1, $2, $3, $4, $5)`, uuid.NewString(), e.ID, q.ID, i+1, e.CreatedAt)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PostgresStore) GetExam(ctx context.Context, userID string, examID string) (Exam, error) {
	row := s.db.QueryRowContext(ctx, `SELECT e.id, COALESCE(e.user_id::text, ''), COALESCE(e.repository_id::text, ''), COALESCE(r.gitea_project_path, ''), e.analysis_job_id::text, e.scheduled_at, e.status, e.score, e.passed, e.passing_score, e.created_at, e.submitted_at
		FROM exams e
		LEFT JOIN repositories r ON r.id = e.repository_id
		WHERE e.id = $1 AND e.user_id = $2`, examID, userID)
	var e Exam
	var score sql.NullInt64
	var passed sql.NullBool
	var scheduled sql.NullTime
	var submitted sql.NullTime
	if err := row.Scan(&e.ID, &e.UserID, &e.RepositoryID, &e.ProjectSlug, &e.AnalysisJobID, &scheduled, &e.Status, &score, &passed, &e.PassingScore, &e.CreatedAt, &submitted); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Exam{}, ErrNotFound
		}
		return Exam{}, err
	}
	if scheduled.Valid {
		e.ScheduledAt = scheduled.Time
	}
	if score.Valid {
		v := int(score.Int64)
		e.Score = &v
	}
	if passed.Valid {
		v := passed.Bool
		e.Passed = &v
	}
	if submitted.Valid {
		e.SubmittedAt = &submitted.Time
	}
	return e, nil
}

func (s *PostgresStore) GetExamQuestions(ctx context.Context, examID string) ([]Question, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT q.id, q.analysis_job_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.difficulty, q.source_file_path, q.created_at, eq.order_index
		FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
		WHERE eq.exam_id = $1 ORDER BY eq.order_index ASC`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanQuestions(rows)
}

func (s *PostgresStore) SaveSubmission(ctx context.Context, examID string, answers []Answer, score int, passed bool, submittedAt time.Time) error {
	return database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		for _, answer := range answers {
			id := answer.ID
			if id == "" {
				id = uuid.NewString()
			}
			_, err := tx.ExecContext(ctx, `INSERT INTO exam_answers (id, exam_id, question_id, selected_option, is_correct, created_at) VALUES ($1, $2, $3, $4, $5, $6)`, id, examID, answer.QuestionID, answer.SelectedOption, answer.IsCorrect, submittedAt)
			if err != nil {
				return err
			}
		}
		status := StatusFailed
		if passed {
			status = StatusPassed
		}
		_, err := tx.ExecContext(ctx, `UPDATE exams SET status = $2, score = $3, passed = $4, submitted_at = $5 WHERE id = $1`, examID, status, score, passed, submittedAt)
		return err
	})
}

func (s *PostgresStore) GetResultAnswers(ctx context.Context, examID string) ([]ResultAnswer, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT ea.question_id::text, ea.selected_option, ea.is_correct, q.correct_option, q.explanation
		FROM exam_answers ea
		JOIN questions q ON q.id = ea.question_id
		JOIN exam_questions eq ON eq.exam_id = ea.exam_id AND eq.question_id = ea.question_id
		WHERE ea.exam_id = $1
		ORDER BY eq.order_index ASC`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	answers := []ResultAnswer{}
	for rows.Next() {
		var answer ResultAnswer
		if err := rows.Scan(&answer.QuestionID, &answer.SelectedOption, &answer.IsCorrect, &answer.CorrectOption, &answer.Explanation); err != nil {
			return nil, err
		}
		answers = append(answers, answer)
	}
	return answers, rows.Err()
}

func (s *PostgresStore) CreatePreparationJob(ctx context.Context, job PreparationJob) (PreparationJob, error) {
	if job.ID == "" {
		job.ID = uuid.NewString()
	}
	if job.Status == "" {
		job.Status = PreparationJobPending
	}
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now().UTC()
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO preparation_jobs (id, user_id, project_slug, repo_url, attempt_id, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`, job.ID, job.UserID, job.ProjectSlug, job.RepoURL, job.AttemptID, job.Status, job.CreatedAt)
	if err != nil {
		return PreparationJob{}, err
	}
	return job, nil
}

func (s *PostgresStore) MarkPreparationJobDownloading(ctx context.Context, jobID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE preparation_jobs SET status = $2, error_message = NULL WHERE id = $1`, jobID, PreparationJobDownloading)
	return err
}

func (s *PostgresStore) CompletePreparationJob(ctx context.Context, jobID, localPath, commitHash string, completedAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE preparation_jobs SET status = $2, local_path = $3, commit_hash = $4, error_message = NULL, completed_at = $5 WHERE id = $1`,
		jobID, PreparationJobCompleted, localPath, commitHash, completedAt)
	return err
}

func (s *PostgresStore) FailPreparationJob(ctx context.Context, jobID, errorMessage string, completedAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE preparation_jobs SET status = $2, error_message = $3, completed_at = $4 WHERE id = $1`,
		jobID, PreparationJobFailed, errorMessage, completedAt)
	return err
}

func (s *PostgresStore) GetTomorrowConnection(ctx context.Context, userID string) (TomorrowConnection, error) {
	var connection TomorrowConnection
	err := s.db.QueryRowContext(ctx, `SELECT username, tomorrow_remote_token, tomorrow_profile_path, tomorrow_login_credential, tomorrow_login_password FROM users WHERE id = $1`, userID).
		Scan(&connection.Username, &connection.RemoteToken, &connection.ProfilePath, &connection.LoginCredential, &connection.LoginPassword)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TomorrowConnection{}, ErrNotFound
		}
		return TomorrowConnection{}, err
	}
	return connection, nil
}

func (s *PostgresStore) ListPreparationJobs(ctx context.Context, userID string) ([]PreparationJob, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, user_id::text, project_slug, repo_url, attempt_id::text, status, COALESCE(local_path, ''), COALESCE(commit_hash, ''), COALESCE(error_message, ''), created_at, completed_at
		FROM preparation_jobs
		WHERE user_id = $1
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := []PreparationJob{}
	for rows.Next() {
		var job PreparationJob
		var completedAt sql.NullTime
		if err := rows.Scan(&job.ID, &job.UserID, &job.ProjectSlug, &job.RepoURL, &job.AttemptID, &job.Status, &job.LocalPath, &job.CommitHash, &job.ErrorMessage, &job.CreatedAt, &completedAt); err != nil {
			return nil, err
		}
		if completedAt.Valid {
			job.CompletedAt = &completedAt.Time
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (s *PostgresStore) UpsertSucceededProjectRepository(ctx context.Context, userID, repoURL, auditText string) (SucceededProjectRepositoryRecord, error) {
	projectPath, err := projectPathFromRepoURL(repoURL)
	if err != nil {
		return SucceededProjectRepositoryRecord{}, err
	}
	record := SucceededProjectRepositoryRecord{}
	now := time.Now().UTC()
	err = s.db.QueryRowContext(ctx, `INSERT INTO repositories (id, user_id, gitea_repo_url, gitea_project_path, tomorrow_audit_text, default_branch, bot_access_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'main', 'granted', $6, $6)
		ON CONFLICT (user_id, gitea_project_path) DO UPDATE SET
			gitea_repo_url = EXCLUDED.gitea_repo_url,
			tomorrow_audit_text = EXCLUDED.tomorrow_audit_text,
			bot_access_status = 'granted',
			updated_at = EXCLUDED.updated_at
		RETURNING id::text, gitea_repo_url, gitea_project_path, tomorrow_audit_text, default_branch`,
		uuid.NewString(), userID, strings.TrimSpace(repoURL), projectPath, strings.TrimSpace(auditText), now,
	).Scan(&record.RepositoryID, &record.RepoURL, &record.ProjectPath, &record.AuditText, &record.DefaultBranch)
	if err != nil {
		return SucceededProjectRepositoryRecord{}, err
	}
	return record, nil
}

func (s *PostgresStore) ListSucceededProjectRepositories(ctx context.Context, userID string) ([]SucceededProjectRepositoryRecord, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT
			r.id::text,
			r.gitea_repo_url,
			r.gitea_project_path,
			r.tomorrow_audit_text,
			r.default_branch,
			COALESCE((
				SELECT aj.id::text
				FROM analysis_jobs aj
				WHERE aj.repository_id = r.id
				ORDER BY aj.created_at DESC
				LIMIT 1
			), ''),
			COALESCE((
				SELECT aj.status
				FROM analysis_jobs aj
				WHERE aj.repository_id = r.id
				ORDER BY aj.created_at DESC
				LIMIT 1
			), ''),
			COALESCE((
				SELECT aj.error_message
				FROM analysis_jobs aj
				WHERE aj.repository_id = r.id
				ORDER BY aj.created_at DESC
				LIMIT 1
			), '')
		FROM repositories r
		WHERE r.user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []SucceededProjectRepositoryRecord{}
	for rows.Next() {
		var record SucceededProjectRepositoryRecord
		if err := rows.Scan(
			&record.RepositoryID,
			&record.RepoURL,
			&record.ProjectPath,
			&record.AuditText,
			&record.DefaultBranch,
			&record.LatestAnalysisJobID,
			&record.LatestAnalysisStatus,
			&record.LatestAnalysisErrorMessage,
		); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *PostgresStore) CreateRepositoryAnalysisJob(ctx context.Context, userID, repositoryID string) (RepositoryAnalysisJobRecord, error) {
	record := RepositoryAnalysisJobRecord{
		ID:           uuid.NewString(),
		UserID:       userID,
		RepositoryID: repositoryID,
		Status:       "pending",
		CreatedAt:    time.Now().UTC(),
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO analysis_jobs (id, user_id, repository_id, status, created_at)
		VALUES ($1, $2, $3, $4, $5)`, record.ID, record.UserID, record.RepositoryID, record.Status, record.CreatedAt)
	if err != nil {
		return RepositoryAnalysisJobRecord{}, err
	}
	return record, nil
}

func (s *PostgresStore) FailRepositoryAnalysisJob(ctx context.Context, analysisJobID, errorMessage string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE analysis_jobs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
		analysisJobID, strings.TrimSpace(errorMessage))
	return err
}

func (s *PostgresStore) ListUserExams(ctx context.Context, userID string) ([]Exam, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT e.id, COALESCE(e.user_id::text, ''), COALESCE(e.repository_id::text, ''), COALESCE(r.gitea_project_path, ''), e.analysis_job_id::text, e.scheduled_at, e.status, e.score, e.passed, e.passing_score, e.created_at, e.submitted_at
		FROM exams e
		LEFT JOIN repositories r ON r.id = e.repository_id
		WHERE e.user_id = $1
		ORDER BY e.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	exams := []Exam{}
	for rows.Next() {
		var e Exam
		var score sql.NullInt64
		var passed sql.NullBool
		var scheduled sql.NullTime
		var submitted sql.NullTime
		if err := rows.Scan(&e.ID, &e.UserID, &e.RepositoryID, &e.ProjectSlug, &e.AnalysisJobID, &scheduled, &e.Status, &score, &passed, &e.PassingScore, &e.CreatedAt, &submitted); err != nil {
			return nil, err
		}
		if scheduled.Valid {
			e.ScheduledAt = scheduled.Time
		}
		if score.Valid {
			v := int(score.Int64)
			e.Score = &v
		}
		if passed.Valid {
			v := passed.Bool
			e.Passed = &v
		}
		if submitted.Valid {
			e.SubmittedAt = &submitted.Time
		}
		exams = append(exams, e)
	}
	return exams, rows.Err()
}

func projectPathFromRepoURL(repoURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(repoURL))
	if err != nil {
		return "", fmt.Errorf("parse repo url: %w", err)
	}
	projectPath := strings.Trim(parsed.Path, "/")
	projectPath = strings.TrimPrefix(projectPath, "git/")
	if projectPath == "" || projectPath == "." || projectPath == "/" {
		return "", fmt.Errorf("repo url must include a project path")
	}
	projectPath = strings.TrimSuffix(projectPath, path.Ext(projectPath))
	return projectPath, nil
}

func scanQuestions(rows *sql.Rows) ([]Question, error) {
	questions := []Question{}
	for rows.Next() {
		var q Question
		if err := rows.Scan(&q.ID, &q.AnalysisJobID, &q.Question, &q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD, &q.CorrectOption, &q.Explanation, &q.Difficulty, &q.SourceFilePath, &q.CreatedAt, &q.OrderIndex); err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}
	return questions, rows.Err()
}
