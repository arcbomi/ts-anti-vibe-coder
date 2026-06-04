package exam

import (
	"context"
	"database/sql"
	"errors"
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
	CreateExamWithQuestions(ctx context.Context, exam Exam, questions []Question) (Exam, error)
	GetExam(ctx context.Context, userID string, examID string) (Exam, error)
	GetExamQuestions(ctx context.Context, examID string) ([]Question, error)
	SaveSubmission(ctx context.Context, examID string, answers []Answer, score int, passed bool, submittedAt time.Time) error
	CountCorrectAnswers(ctx context.Context, examID string) (int, error)
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
	row := s.db.QueryRowContext(ctx, `SELECT id, COALESCE(user_id::text, ''), COALESCE(repository_id::text, ''), analysis_job_id::text, scheduled_at, status, score, passed, passing_score, created_at, submitted_at
		FROM exams WHERE id = $1 AND user_id = $2`, examID, userID)
	var e Exam
	var score sql.NullInt64
	var passed sql.NullBool
	var scheduled sql.NullTime
	var submitted sql.NullTime
	if err := row.Scan(&e.ID, &e.UserID, &e.RepositoryID, &e.AnalysisJobID, &scheduled, &e.Status, &score, &passed, &e.PassingScore, &e.CreatedAt, &submitted); err != nil {
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
		_, err := tx.ExecContext(ctx, `UPDATE exams SET status = $2, score = $3, passed = $4, submitted_at = $5 WHERE id = $1`, examID, StatusGraded, score, passed, submittedAt)
		return err
	})
}

func (s *PostgresStore) CountCorrectAnswers(ctx context.Context, examID string) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM exam_answers WHERE exam_id = $1 AND is_correct = TRUE`, examID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
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
