package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAnalysisIntegrationQueueWorkerAndQuestionSaveFlow(t *testing.T) {
	app := newTestApp(t)
	userID, token := createIntegrationUser(t, app.db, "analysis-owner@example.com")
	repositoryID := createRepositoryViaAPI(t, app, userID, token)
	grantBotAccess(t, app, userID, token, repositoryID)

	jobID := startAnalysisViaAPI(t, app, userID, token, repositoryID)
	if n := app.redis.LLen(context.Background(), "analysis_jobs").Val(); n != 1 {
		t.Fatalf("queue should receive exactly one analysis job message, got %d", n)
	}

	app.runOneWorkerJob(t)

	var status string
	if err := app.db.QueryRowContext(context.Background(), `SELECT status FROM analysis_jobs WHERE id = $1`, jobID).Scan(&status); err != nil {
		t.Fatalf("load analysis job status: %v", err)
	}
	if status != "completed" {
		t.Fatalf("analysis job status = %q, want completed", status)
	}
	var generatedCount, questionCount int
	if err := app.db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM generated_questions WHERE analysis_job_id = $1`, jobID).Scan(&generatedCount); err != nil {
		t.Fatalf("count generated questions: %v", err)
	}
	if err := app.db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM questions WHERE analysis_job_id = $1`, jobID).Scan(&questionCount); err != nil {
		t.Fatalf("count exam questions: %v", err)
	}
	if generatedCount != 20 || questionCount != 20 {
		t.Fatalf("worker should save 20 questions for generated and exam tables, got generated=%d questions=%d", generatedCount, questionCount)
	}
	rows, err := app.db.QueryContext(context.Background(), `SELECT question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path FROM questions WHERE analysis_job_id = $1`, jobID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var q, a, b, c, d, correct, explanation, difficulty, source string
		if err := rows.Scan(&q, &a, &b, &c, &d, &correct, &explanation, &difficulty, &source); err != nil {
			t.Fatal(err)
		}
		if !isEnglishASCII(q+a+b+c+d+explanation) || correct == "" || explanation == "" || difficulty == "" || source == "" {
			t.Fatalf("saved question did not meet English-only A/B/C/D requirements: question=%q correct=%q explanation=%q", q, correct, explanation)
		}
	}
}

func TestAnalysisIntegrationInvalidAIOutputFailsJob(t *testing.T) {
	app := newTestApp(t)
	app.ai.SetInvalidJSON(true)
	userID, token := createIntegrationUser(t, app.db, "failed-analysis-owner@example.com")
	repositoryID := createRepositoryViaAPI(t, app, userID, token)
	grantBotAccess(t, app, userID, token, repositoryID)
	jobID := startAnalysisViaAPI(t, app, userID, token, repositoryID)

	app.runOneWorkerJobAllowError(t)

	var status string
	var errorMessage sql.NullString
	var errorCode sql.NullString
	if err := app.db.QueryRowContext(context.Background(), `SELECT status, error_message, error_code FROM analysis_jobs WHERE id = $1`, jobID).Scan(&status, &errorMessage, &errorCode); err != nil {
		t.Fatalf("load failed analysis job: %v", err)
	}
	if status != "failed" || !errorMessage.Valid || errorMessage.String == "" || !errorCode.Valid {
		t.Fatalf("invalid AI output should fail job and save error, status=%q code=%v message=%v", status, errorCode, errorMessage)
	}
}

func grantBotAccess(t *testing.T, app *testApp, userID, token, repositoryID string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/repositories/"+repositoryID+"/check-bot-access", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-User-Id", userID)
	res := httptest.NewRecorder()
	app.router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("grant bot access status=%d body=%s", res.Code, res.Body.String())
	}
}

func startAnalysisViaAPI(t *testing.T, app *testApp, userID, token, repositoryID string) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/repositories/"+repositoryID+"/start-analysis", bytes.NewReader(nil))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-User-Id", userID)
	res := httptest.NewRecorder()
	app.router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("start analysis status=%d body=%s", res.Code, res.Body.String())
	}
	var env apiEnvelope
	_ = json.Unmarshal(res.Body.Bytes(), &env)
	var data struct {
		AnalysisJobID string `json:"analysis_job_id"`
		Status        string `json:"status"`
	}
	_ = json.Unmarshal(env.Data, &data)
	if data.AnalysisJobID == "" || data.Status != "pending" {
		t.Fatalf("unexpected start analysis payload: %s", res.Body.String())
	}
	return data.AnalysisJobID
}
