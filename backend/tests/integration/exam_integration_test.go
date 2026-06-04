//go:build integration
// +build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestExamIntegrationLoadsQuestionsWithoutAnswersAndGradesSubmission(t *testing.T) {
	app := newTestApp(t)
	userID, token := createIntegrationUser(t, app.db, "exam-owner@example.com")
	repositoryID := uuid.NewString()
	analysisJobID := uuid.NewString()
	seedRepositoryAndQuestions(t, app, userID, repositoryID, analysisJobID)

	createBody, _ := json.Marshal(map[string]any{"user_id": "00000000-0000-0000-0000-000000000099", "repository_id": repositoryID, "analysis_job_id": analysisJobID, "scheduled_at": time.Date(2026, 6, 5, 9, 0, 0, 0, time.UTC)})
	createReq := httptest.NewRequest(http.MethodPost, "/exams", bytes.NewReader(createBody))
	createReq.Header.Set("Authorization", "Bearer "+token)
	createReq.Header.Set("Content-Type", "application/json")
	createRes := httptest.NewRecorder()
	app.router.ServeHTTP(createRes, createReq)
	if createRes.Code != http.StatusOK {
		t.Fatalf("create exam status=%d body=%s", createRes.Code, createRes.Body.String())
	}
	var createEnv apiEnvelope
	_ = json.Unmarshal(createRes.Body.Bytes(), &createEnv)
	var created struct {
		ExamID string `json:"exam_id"`
		Status string `json:"status"`
	}
	_ = json.Unmarshal(createEnv.Data, &created)
	if created.ExamID == "" || created.Status != "scheduled" {
		t.Fatalf("unexpected create exam payload: %s", createRes.Body.String())
	}

	questionsReq := httptest.NewRequest(http.MethodGet, "/exams/"+created.ExamID+"/questions", nil)
	questionsReq.Header.Set("Authorization", "Bearer "+token)
	questionsRes := httptest.NewRecorder()
	app.router.ServeHTTP(questionsRes, questionsReq)
	if questionsRes.Code != http.StatusOK {
		t.Fatalf("exam questions status=%d body=%s", questionsRes.Code, questionsRes.Body.String())
	}
	body := questionsRes.Body.Bytes()
	if bytes.Contains(body, []byte("correct_option")) || bytes.Contains(body, []byte("explanation")) {
		t.Fatalf("active exam question API must not expose correct_option or explanation: %s", string(body))
	}
	var questionsEnv apiEnvelope
	_ = json.Unmarshal(body, &questionsEnv)
	var qData struct {
		ExamID    string `json:"exam_id"`
		Questions []struct {
			QuestionID string            `json:"question_id"`
			Question   string            `json:"question"`
			Options    map[string]string `json:"options"`
		} `json:"questions"`
	}
	_ = json.Unmarshal(questionsEnv.Data, &qData)
	if len(qData.Questions) != 20 {
		t.Fatalf("exam should load exactly 20 questions, got %d", len(qData.Questions))
	}
	answers := make([]map[string]string, 0, 20)
	for i, q := range qData.Questions {
		if len(q.Options) != 4 || q.Options["A"] == "" || q.Options["B"] == "" || q.Options["C"] == "" || q.Options["D"] == "" {
			t.Fatalf("question does not include A/B/C/D options: %+v", q)
		}
		selected := "B"
		if i >= 14 {
			selected = "A"
		}
		answers = append(answers, map[string]string{"question_id": q.QuestionID, "selected_option": selected})
	}

	submitBody, _ := json.Marshal(map[string]any{"answers": answers})
	submitReq := httptest.NewRequest(http.MethodPost, "/exams/"+created.ExamID+"/submit", bytes.NewReader(submitBody))
	submitReq.Header.Set("Authorization", "Bearer "+token)
	submitReq.Header.Set("Content-Type", "application/json")
	submitRes := httptest.NewRecorder()
	app.router.ServeHTTP(submitRes, submitReq)
	if submitRes.Code != http.StatusOK {
		t.Fatalf("submit exam status=%d body=%s", submitRes.Code, submitRes.Body.String())
	}
	var resultEnv apiEnvelope
	_ = json.Unmarshal(submitRes.Body.Bytes(), &resultEnv)
	var result struct {
		TotalQuestions int  `json:"total_questions"`
		CorrectCount   int  `json:"correct_count"`
		Score          int  `json:"score"`
		PassingScore   int  `json:"passing_score"`
		Passed         bool `json:"passed"`
	}
	_ = json.Unmarshal(resultEnv.Data, &result)
	if result.TotalQuestions != 20 || result.CorrectCount != 14 || result.Score != 70 || !result.Passed || result.PassingScore != 70 {
		t.Fatalf("unexpected graded result: %s", submitRes.Body.String())
	}

	resultReq := httptest.NewRequest(http.MethodGet, "/exams/"+created.ExamID+"/result", nil)
	resultReq.Header.Set("Authorization", "Bearer "+token)
	resultRes := httptest.NewRecorder()
	app.router.ServeHTTP(resultRes, resultReq)
	if resultRes.Code != http.StatusOK || !bytes.Contains(resultRes.Body.Bytes(), []byte(`"status":"graded"`)) {
		t.Fatalf("result endpoint should return score and pass/fail: status=%d body=%s", resultRes.Code, resultRes.Body.String())
	}
}

func TestExamIntegrationRejectsCrossUserAccess(t *testing.T) {
	app := newTestApp(t)
	ownerID, ownerToken := createIntegrationUser(t, app.db, "owner@example.com")
	_, otherToken := createIntegrationUser(t, app.db, "other@example.com")
	repositoryID := uuid.NewString()
	analysisJobID := uuid.NewString()
	seedRepositoryAndQuestions(t, app, ownerID, repositoryID, analysisJobID)

	createBody, _ := json.Marshal(map[string]any{"repository_id": repositoryID, "analysis_job_id": analysisJobID, "scheduled_at": time.Date(2026, 6, 5, 9, 0, 0, 0, time.UTC)})
	createReq := httptest.NewRequest(http.MethodPost, "/exams", bytes.NewReader(createBody))
	createReq.Header.Set("Authorization", "Bearer "+ownerToken)
	createReq.Header.Set("Content-Type", "application/json")
	createRes := httptest.NewRecorder()
	app.router.ServeHTTP(createRes, createReq)
	if createRes.Code != http.StatusOK {
		t.Fatalf("create exam status=%d body=%s", createRes.Code, createRes.Body.String())
	}
	var createEnv apiEnvelope
	_ = json.Unmarshal(createRes.Body.Bytes(), &createEnv)
	var created struct {
		ExamID string `json:"exam_id"`
	}
	_ = json.Unmarshal(createEnv.Data, &created)

	examReq := httptest.NewRequest(http.MethodGet, "/exams/"+created.ExamID, nil)
	examReq.Header.Set("Authorization", "Bearer "+otherToken)
	examRes := httptest.NewRecorder()
	app.router.ServeHTTP(examRes, examReq)
	if examRes.Code != http.StatusNotFound {
		t.Fatalf("cross-user exam fetch should 404: status=%d body=%s", examRes.Code, examRes.Body.String())
	}

	analysisReq := httptest.NewRequest(http.MethodGet, "/analysis-jobs/"+analysisJobID+"/questions", nil)
	analysisReq.Header.Set("Authorization", "Bearer "+otherToken)
	analysisRes := httptest.NewRecorder()
	app.router.ServeHTTP(analysisRes, analysisReq)
	if analysisRes.Code != http.StatusNotFound {
		t.Fatalf("cross-user analysis questions should 404: status=%d body=%s", analysisRes.Code, analysisRes.Body.String())
	}
}

func seedRepositoryAndQuestions(t *testing.T, app *testApp, userID, repositoryID, analysisJobID string) {
	t.Helper()
	_, err := app.db.ExecContext(context.Background(), `INSERT INTO repositories (id, user_id, gitlab_repo_url, gitlab_project_path, default_branch, bot_access_status) VALUES ($1,$2,$3,$4,'main','granted')`, repositoryID, userID, app.gitlab.RepoURL(), "group/project")
	if err != nil {
		t.Fatalf("seed repository: %v", err)
	}
	_, err = app.db.ExecContext(context.Background(), `INSERT INTO analysis_jobs (id, user_id, repository_id, status, completed_at) VALUES ($1,$2,$3,'completed',now())`, analysisJobID, userID, repositoryID)
	if err != nil {
		t.Fatalf("seed analysis job: %v", err)
	}
	for i := 0; i < 20; i++ {
		_, err = app.db.ExecContext(context.Background(), `INSERT INTO questions (id, analysis_job_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, source_file_path) VALUES ($1,$2,$3,$4,$5,$6,$7,'B',$8,'medium','internal/server/router.go')`, uuid.NewString(), analysisJobID, fmt.Sprintf("Question %02d about how handlers call services?", i+1), "The database registers routes.", "Handlers call services after request parsing.", "The frontend grades answers.", "GitLab creates users automatically.", "The route and handler code show this flow.")
		if err != nil {
			t.Fatalf("seed question %d: %v", i+1, err)
		}
	}
}
