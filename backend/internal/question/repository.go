package question

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"backend/pkg/sdk/database"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type Store interface {
	EnsureSchema(ctx context.Context) error
	SaveGeneratedQuestions(ctx context.Context, analysisJobID string, questions []Question) (int, error)
	GetQuestionsByAnalysisJob(ctx context.Context, analysisJobID string) ([]Question, error)
	GetQuestionsByExam(ctx context.Context, examID string) ([]Question, error)
	GetExamOptionMappings(ctx context.Context, examID string) ([]ExamQuestionOption, error)
	SaveExamOptionMappings(ctx context.Context, examID string, mappings []ExamQuestionOption) error
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
			difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
			source_file_path TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_questions_analysis_job_id ON questions(analysis_job_id)`,
		`CREATE TABLE IF NOT EXISTS exams (
			id UUID PRIMARY KEY,
			analysis_job_id UUID NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_exams_analysis_job_id ON exams(analysis_job_id)`,
		`CREATE TABLE IF NOT EXISTS exam_question_options (
			id UUID PRIMARY KEY,
			exam_id UUID NOT NULL,
			question_id UUID NOT NULL,
			display_option TEXT NOT NULL CHECK (display_option IN ('A', 'B', 'C', 'D')),
			original_option TEXT NOT NULL CHECK (original_option IN ('A', 'B', 'C', 'D')),
			option_text TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (exam_id, question_id, display_option)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_exam_question_options_exam_id ON exam_question_options(exam_id)`,
		`CREATE INDEX IF NOT EXISTS idx_exam_question_options_question_id ON exam_question_options(question_id)`,
	}
	for _, stmt := range statements {
		if _, err := s.db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostgresStore) SaveGeneratedQuestions(ctx context.Context, analysisJobID string, questions []Question) (int, error) {
	return len(questions), database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM questions WHERE analysis_job_id = $1`, analysisJobID); err != nil {
			return err
		}
		query := `INSERT INTO questions (id, analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
		for i := range questions {
			q := &questions[i]
			if q.ID == "" {
				q.ID = uuid.NewString()
			}
			if q.CreatedAt.IsZero() {
				q.CreatedAt = time.Now().UTC()
			}
			if _, err := tx.ExecContext(ctx, query, q.ID, analysisJobID, q.Question, q.OptionA, q.OptionB, q.OptionC, q.OptionD, q.CorrectOption, q.Explanation, q.Difficulty, q.SourceFilePath, q.CreatedAt); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PostgresStore) GetQuestionsByAnalysisJob(ctx context.Context, analysisJobID string) ([]Question, error) {
	query := `SELECT id, analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path, created_at
		FROM questions WHERE analysis_job_id = $1 ORDER BY created_at ASC, id ASC`
	return s.scanQuestions(ctx, query, analysisJobID)
}

func (s *PostgresStore) GetQuestionsByExam(ctx context.Context, examID string) ([]Question, error) {
	query := `SELECT q.id, q.analysis_job_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation, q.difficulty, q.source_file_path, q.created_at
		FROM questions q
		JOIN exams e ON e.analysis_job_id = q.analysis_job_id
		WHERE e.id = $1
		ORDER BY q.created_at ASC, q.id ASC`
	questions, err := s.scanQuestions(ctx, query, examID)
	if err == nil {
		return questions, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	// MVP fallback: allow examId to be the analysis_job_id while the Exam Service schema is still being built.
	return s.GetQuestionsByAnalysisJob(ctx, examID)
}

func (s *PostgresStore) GetExamOptionMappings(ctx context.Context, examID string) ([]ExamQuestionOption, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, exam_id, question_id, display_option, original_option, option_text
		FROM exam_question_options WHERE exam_id = $1 ORDER BY question_id ASC, display_option ASC`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	mappings := []ExamQuestionOption{}
	for rows.Next() {
		var m ExamQuestionOption
		if err := rows.Scan(&m.ID, &m.ExamID, &m.QuestionID, &m.DisplayOption, &m.OriginalOption, &m.OptionText); err != nil {
			return nil, err
		}
		mappings = append(mappings, m)
	}
	return mappings, rows.Err()
}

func (s *PostgresStore) SaveExamOptionMappings(ctx context.Context, examID string, mappings []ExamQuestionOption) error {
	return database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		query := `INSERT INTO exam_question_options (id, exam_id, question_id, display_option, original_option, option_text)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (exam_id, question_id, display_option) DO UPDATE SET
				original_option = EXCLUDED.original_option,
				option_text = EXCLUDED.option_text`
		for i := range mappings {
			m := mappings[i]
			if m.ID == "" {
				m.ID = uuid.NewString()
			}
			if _, err := tx.ExecContext(ctx, query, m.ID, examID, m.QuestionID, m.DisplayOption, m.OriginalOption, m.OptionText); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PostgresStore) scanQuestions(ctx context.Context, query string, args ...any) ([]Question, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	questions := []Question{}
	for rows.Next() {
		var q Question
		if err := rows.Scan(&q.ID, &q.AnalysisJobID, &q.Question, &q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD, &q.CorrectOption, &q.Explanation, &q.Difficulty, &q.SourceFilePath, &q.CreatedAt); err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(questions) == 0 {
		return nil, ErrNotFound
	}
	return questions, nil
}

func validateUUID(value string, field string) error {
	if _, err := uuid.Parse(value); err != nil {
		return fmt.Errorf("%s must be a valid uuid", field)
	}
	return nil
}
