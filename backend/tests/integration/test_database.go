package integration

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	"backend/internal/auth"
	"backend/internal/exam"
	gitlabsvc "backend/internal/gitlab"
	"backend/internal/question"
	"backend/internal/worker"
	"backend/pkg/sdk/database"
)

func openTestDatabase(t *testing.T) *sql.DB {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if dsn == "" {
		dsn = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL or DATABASE_URL is required for PostgreSQL integration tests")
	}
	db, err := database.Connect(dsn)
	if err != nil {
		t.Skipf("PostgreSQL integration database is unavailable: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	resetTestDatabase(t, db)
	return db
}

func resetTestDatabase(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
		`DROP TABLE IF EXISTS exam_answers, exam_questions, exam_question_options, exams, generated_questions, questions, analysis_jobs, repositories, users CASCADE`,
		`CREATE TABLE users (
			id UUID PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			auth_provider TEXT NOT NULL DEFAULT 'local',
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
	}
	for _, stmt := range statements {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			t.Fatalf("reset test database: %v", err)
		}
	}
	stores := []interface{ EnsureSchema(context.Context) error }{
		gitlabsvc.NewPostgresStore(db),
		worker.NewPostgresStore(db),
		question.NewPostgresStore(db),
		exam.NewPostgresStore(db),
	}
	for _, store := range stores {
		if err := store.EnsureSchema(ctx); err != nil {
			t.Fatalf("ensure integration schema: %v", err)
		}
	}
}

func createIntegrationUser(t *testing.T, db *sql.DB, email string) (userID string, token string) {
	t.Helper()
	tm, err := auth.NewTokenManager("integration-test-jwt-secret", 2_000_000_000_000)
	if err != nil {
		t.Fatal(err)
	}
	svc := auth.NewService(auth.NewRepository(db), tm)
	resp, err := svc.Register(context.Background(), auth.RegisterRequest{Name: "Integration User", Email: email, Password: "correct-password"})
	if err != nil {
		t.Fatalf("register integration user: %v", err)
	}
	return resp.User.ID, resp.AccessToken
}
