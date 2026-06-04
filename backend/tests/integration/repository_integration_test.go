//go:build integration
// +build integration

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
	app.gitlab.SetAccess(false)

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

func createRepositoryViaAPI(t *testing.T, app *testApp, userID, token string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"gitlab_repo_url": app.gitlab.RepoURL()})
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
		GitLabRepoURL   string `json:"gitlab_repo_url"`
	}
	_ = json.Unmarshal(env.Data, &data)
	if data.RepositoryID == "" || data.BotAccessStatus != "unknown" || data.GitLabRepoURL != app.gitlab.RepoURL() {
		t.Fatalf("unexpected repository create payload: %s", res.Body.String())
	}
	return data.RepositoryID
}
