//go:build integration
// +build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/internal/exam"
)

func TestRepositoryIntegrationSubmitAndCheckBotAccess(t *testing.T) {
	app := newTestApp(t)
	userID, token := createIntegrationUser(t, app.db, "repo-owner@example.com")

	repositoryID := createRepositoryViaAPI(t, app, userID, token)

	checkReq := httptest.NewRequest(http.MethodPost, "/repositories/"+repositoryID+"/check-bot-access", nil)
	checkReq.Header.Set("Authorization", "Bearer "+token)
	checkRes := httptest.NewRecorder()
	app.router.ServeHTTP(checkRes, checkReq)
	if checkRes.Code != http.StatusOK {
		t.Fatalf("check bot access status=%d body=%s", checkRes.Code, checkRes.Body.String())
	}
	if !bytes.Contains(checkRes.Body.Bytes(), []byte(`"bot_access_status":"granted"`)) {
		t.Fatalf("bot access should become granted: %s", checkRes.Body.String())
	}
}

func TestRepositoryIntegrationBotAccessDenied(t *testing.T) {
	app := newTestApp(t)
	userID, token := createIntegrationUser(t, app.db, "denied-owner@example.com")
	repositoryID := createRepositoryViaAPI(t, app, userID, token)
	app.gitea.SetAccess(false)

	checkReq := httptest.NewRequest(http.MethodPost, "/repositories/"+repositoryID+"/check-bot-access", nil)
	checkReq.Header.Set("Authorization", "Bearer "+token)
	checkRes := httptest.NewRecorder()
	app.router.ServeHTTP(checkRes, checkReq)
	if checkRes.Code != http.StatusForbidden {
		t.Fatalf("denied bot access status=%d body=%s", checkRes.Code, checkRes.Body.String())
	}
	var env apiEnvelope
	_ = json.Unmarshal(checkRes.Body.Bytes(), &env)
	if env.Success || env.Error == nil || env.Error.Code != "BOT_ACCESS_DENIED" {
		t.Fatalf("expected BOT_ACCESS_DENIED envelope: %s", checkRes.Body.String())
	}
}

func TestRepositoryIntegrationSyncTomorrowProjects(t *testing.T) {
	app := newTestApp(t)
	_, token := createConnectedIntegrationUser(t, app.db, "dmukhat")

	req := httptest.NewRequest(http.MethodPost, "/repositories/sync-tomorrow", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	app.router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("sync tomorrow status=%d body=%s", res.Code, res.Body.String())
	}

	var env apiEnvelope
	_ = json.Unmarshal(res.Body.Bytes(), &env)
	var data []struct {
		GiteaRepoURL      string `json:"gitea_repo_url"`
		GiteaProjectPath  string `json:"gitea_project_path"`
		TomorrowAuditText string `json:"tomorrow_audit_text"`
	}
	_ = json.Unmarshal(env.Data, &data)
	if len(data) != 1 {
		t.Fatalf("expected 1 synced repository: %s", res.Body.String())
	}
	if data[0].GiteaRepoURL != "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded" {
		t.Fatalf("unexpected synced repo: %+v", data[0])
	}
	if data[0].TomorrowAuditText != "5 peer audits required" {
		t.Fatalf("unexpected audit text: %+v", data[0])
	}
}

func TestSucceededProjectPreparationDownloadsRepoAndStartsQuestionWorkflow(t *testing.T) {
	app := newTestApp(t)
	_, token := createConnectedIntegrationUser(t, app.db, "dmukhat")

	listReq := httptest.NewRequest(http.MethodGet, "/succeeded-projects", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listRes := httptest.NewRecorder()
	app.router.ServeHTTP(listRes, listReq)
	if listRes.Code != http.StatusOK || !bytes.Contains(listRes.Body.Bytes(), []byte(`"preparation_status":"not_started"`)) {
		t.Fatalf("expected not prepared succeeded project: status=%d body=%s", listRes.Code, listRes.Body.String())
	}

	startReq := httptest.NewRequest(http.MethodPost, "/succeeded-projects/go-reloaded/prepare", nil)
	startReq.Header.Set("Authorization", "Bearer "+token)
	startRes := httptest.NewRecorder()
	app.router.ServeHTTP(startRes, startReq)
	if startRes.Code != http.StatusOK {
		t.Fatalf("start preparation status=%d body=%s", startRes.Code, startRes.Body.String())
	}

	preparingReq := httptest.NewRequest(http.MethodGet, "/succeeded-projects", nil)
	preparingReq.Header.Set("Authorization", "Bearer "+token)
	preparingRes := httptest.NewRecorder()
	app.router.ServeHTTP(preparingRes, preparingReq)
	if preparingRes.Code != http.StatusOK || !bytes.Contains(preparingRes.Body.Bytes(), []byte(`"preparation_status":"preparing"`)) {
		t.Fatalf("expected preparing status after Try Pass: status=%d body=%s", preparingRes.Code, preparingRes.Body.String())
	}

	app.runOneRepoDownloadJob(t, integrationRepoDownloader{
		repo: &exam.DownloadedRepo{
			LocalPath:    createDownloadedRepoFixture(t),
			CommitHash:   "abc123",
			DownloadedAt: time.Date(2026, 6, 23, 10, 0, 0, 0, time.UTC),
		},
	})

	readyReq := httptest.NewRequest(http.MethodGet, "/succeeded-projects", nil)
	readyReq.Header.Set("Authorization", "Bearer "+token)
	readyRes := httptest.NewRecorder()
	app.router.ServeHTTP(readyRes, readyReq)
	if readyRes.Code != http.StatusOK || !bytes.Contains(readyRes.Body.Bytes(), []byte(`"preparation_status":"ready_to_pass"`)) || !bytes.Contains(readyRes.Body.Bytes(), []byte(`"exam_id":"`)) {
		t.Fatalf("expected ready project after question generation: status=%d body=%s", readyRes.Code, readyRes.Body.String())
	}
}

func TestSucceededProjectPreparationCanReachPassedResultAndBlockRetry(t *testing.T) {
	app := newTestApp(t)
	_, token := createConnectedIntegrationUser(t, app.db, "dmukhat")

	startReq := httptest.NewRequest(http.MethodPost, "/succeeded-projects/go-reloaded/prepare", nil)
	startReq.Header.Set("Authorization", "Bearer "+token)
	startRes := httptest.NewRecorder()
	app.router.ServeHTTP(startRes, startReq)
	if startRes.Code != http.StatusOK {
		t.Fatalf("start preparation status=%d body=%s", startRes.Code, startRes.Body.String())
	}

	app.runOneRepoDownloadJob(t, integrationRepoDownloader{
		repo: &exam.DownloadedRepo{
			LocalPath:    createDownloadedRepoFixture(t),
			CommitHash:   "abc123",
			DownloadedAt: time.Date(2026, 6, 23, 10, 0, 0, 0, time.UTC),
		},
	})

	readyReq := httptest.NewRequest(http.MethodGet, "/succeeded-projects", nil)
	readyReq.Header.Set("Authorization", "Bearer "+token)
	readyRes := httptest.NewRecorder()
	app.router.ServeHTTP(readyRes, readyReq)
	if readyRes.Code != http.StatusOK {
		t.Fatalf("ready project list status=%d body=%s", readyRes.Code, readyRes.Body.String())
	}

	var readyEnv apiEnvelope
	_ = json.Unmarshal(readyRes.Body.Bytes(), &readyEnv)
	var readyData struct {
		Projects []struct {
			ProjectSlug       string `json:"project_slug"`
			PreparationStatus string `json:"preparation_status"`
			ExamID            string `json:"exam_id"`
		} `json:"projects"`
	}
	_ = json.Unmarshal(readyEnv.Data, &readyData)
	if len(readyData.Projects) != 1 || readyData.Projects[0].PreparationStatus != "ready_to_pass" || readyData.Projects[0].ExamID == "" {
		t.Fatalf("expected ready project with exam id: %s", readyRes.Body.String())
	}
	examID := readyData.Projects[0].ExamID

	questionsReq := httptest.NewRequest(http.MethodGet, "/exams/"+examID+"/questions", nil)
	questionsReq.Header.Set("Authorization", "Bearer "+token)
	questionsRes := httptest.NewRecorder()
	app.router.ServeHTTP(questionsRes, questionsReq)
	if questionsRes.Code != http.StatusOK {
		t.Fatalf("exam questions status=%d body=%s", questionsRes.Code, questionsRes.Body.String())
	}

	var questionsEnv apiEnvelope
	_ = json.Unmarshal(questionsRes.Body.Bytes(), &questionsEnv)
	var questionsData struct {
		Questions []struct {
			QuestionID string `json:"question_id"`
		} `json:"questions"`
	}
	_ = json.Unmarshal(questionsEnv.Data, &questionsData)
	if len(questionsData.Questions) != 20 {
		t.Fatalf("expected 20 exam questions, got %d", len(questionsData.Questions))
	}

	answers := make([]map[string]string, 0, 20)
	for _, question := range questionsData.Questions {
		answers = append(answers, map[string]string{
			"question_id":     question.QuestionID,
			"selected_option": "B",
		})
	}

	submitBody, _ := json.Marshal(map[string]any{"answers": answers})
	submitReq := httptest.NewRequest(http.MethodPost, "/exams/"+examID+"/submit", bytes.NewReader(submitBody))
	submitReq.Header.Set("Authorization", "Bearer "+token)
	submitReq.Header.Set("Content-Type", "application/json")
	submitRes := httptest.NewRecorder()
	app.router.ServeHTTP(submitRes, submitReq)
	if submitRes.Code != http.StatusOK || !bytes.Contains(submitRes.Body.Bytes(), []byte(`"status":"passed"`)) {
		t.Fatalf("submit exam should pass: status=%d body=%s", submitRes.Code, submitRes.Body.String())
	}

	passedReq := httptest.NewRequest(http.MethodGet, "/succeeded-projects", nil)
	passedReq.Header.Set("Authorization", "Bearer "+token)
	passedRes := httptest.NewRecorder()
	app.router.ServeHTTP(passedRes, passedReq)
	if passedRes.Code != http.StatusOK || !bytes.Contains(passedRes.Body.Bytes(), []byte(`"preparation_status":"passed"`)) {
		t.Fatalf("expected passed project after grading: status=%d body=%s", passedRes.Code, passedRes.Body.String())
	}

	retryReq := httptest.NewRequest(http.MethodPost, "/succeeded-projects/go-reloaded/prepare", nil)
	retryReq.Header.Set("Authorization", "Bearer "+token)
	retryRes := httptest.NewRecorder()
	app.router.ServeHTTP(retryRes, retryReq)
	if retryRes.Code != http.StatusConflict {
		t.Fatalf("expected retry to be blocked for passed project: status=%d body=%s", retryRes.Code, retryRes.Body.String())
	}
}

func TestSucceededProjectPreparationFailureIsVisibleOnProjectPage(t *testing.T) {
	app := newTestApp(t)
	_, token := createConnectedIntegrationUser(t, app.db, "dmukhat")

	startReq := httptest.NewRequest(http.MethodPost, "/succeeded-projects/go-reloaded/prepare", nil)
	startReq.Header.Set("Authorization", "Bearer "+token)
	startRes := httptest.NewRecorder()
	app.router.ServeHTTP(startRes, startReq)
	if startRes.Code != http.StatusOK {
		t.Fatalf("start preparation status=%d body=%s", startRes.Code, startRes.Body.String())
	}

	app.runOneRepoDownloadJobAllowError(t, integrationRepoDownloader{err: context.DeadlineExceeded})

	listReq := httptest.NewRequest(http.MethodGet, "/succeeded-projects", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listRes := httptest.NewRecorder()
	app.router.ServeHTTP(listRes, listReq)
	if listRes.Code != http.StatusOK || !bytes.Contains(listRes.Body.Bytes(), []byte(`"preparation_status":"failed_generation"`)) {
		t.Fatalf("expected failure status after download error: status=%d body=%s", listRes.Code, listRes.Body.String())
	}
}

type integrationRepoDownloader struct {
	repo *exam.DownloadedRepo
	err  error
}

func (d integrationRepoDownloader) Download(context.Context, exam.DownloadRepoRequest) (*exam.DownloadedRepo, error) {
	if d.err != nil {
		return nil, d.err
	}
	return d.repo, nil
}

func createRepositoryViaAPI(t *testing.T, app *testApp, userID, token string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"gitea_repo_url": app.gitea.RepoURL()})
	req := httptest.NewRequest(http.MethodPost, "/repositories", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	app.router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("create repository status=%d body=%s", res.Code, res.Body.String())
	}
	var env apiEnvelope
	_ = json.Unmarshal(res.Body.Bytes(), &env)
	var data struct {
		RepositoryID    string `json:"repository_id"`
		BotAccessStatus string `json:"bot_access_status"`
		GiteaRepoURL    string `json:"gitea_repo_url"`
	}
	_ = json.Unmarshal(env.Data, &data)
	if data.RepositoryID == "" || data.BotAccessStatus != "unknown" || data.GiteaRepoURL != app.gitea.RepoURL() {
		t.Fatalf("unexpected repository create payload: %s", res.Body.String())
	}
	return data.RepositoryID
}

func createDownloadedRepoFixture(t *testing.T) string {
	t.Helper()
	root := filepath.Join(t.TempDir(), "source")
	if err := os.MkdirAll(filepath.Join(root, "cmd", "server"), 0o755); err != nil {
		t.Fatalf("mkdir repo fixture: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "cmd", "server", "main.go"), []byte("package main\n\nfunc main() {}\n"), 0o644); err != nil {
		t.Fatalf("write main.go: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "README.md"), []byte("# Sample\n"), 0o644); err != nil {
		t.Fatalf("write README: %v", err)
	}
	return root
}
