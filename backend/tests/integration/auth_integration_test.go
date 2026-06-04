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

func TestAuthIntegrationLoginMeAndInvalidLogin(t *testing.T) {
	app := newTestApp(t)

	registerBody := []byte(`{"name":"Ada Lovelace","email":"ada@example.com","password":"correct-password"}`)
	registerReq := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(registerBody))
	registerReq.Header.Set("Content-Type", "application/json")
	registerRes := httptest.NewRecorder()
	app.router.ServeHTTP(registerRes, registerReq)
	if registerRes.Code != http.StatusOK {
		t.Fatalf("register status=%d body=%s", registerRes.Code, registerRes.Body.String())
	}

	loginBody := []byte(`{"credential":"ada@example.com","password":"correct-password"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRes := httptest.NewRecorder()
	app.router.ServeHTTP(loginRes, loginReq)
	if loginRes.Code != http.StatusOK {
		t.Fatalf("login status=%d body=%s", loginRes.Code, loginRes.Body.String())
	}
	var loginEnv apiEnvelope
	if err := json.Unmarshal(loginRes.Body.Bytes(), &loginEnv); err != nil || !loginEnv.Success || loginEnv.Error != nil {
		t.Fatalf("login envelope err=%v env=%+v", err, loginEnv)
	}
	var loginData struct {
		AccessToken string `json:"access_token"`
		User        struct {
			ID       string `json:"id"`
			Email    string `json:"email"`
			Name     string `json:"name"`
			FullName string `json:"full_name"`
		} `json:"user"`
	}
	if err := json.Unmarshal(loginEnv.Data, &loginData); err != nil || loginData.AccessToken == "" || loginData.User.Email != "ada@example.com" {
		t.Fatalf("login data err=%v data=%+v", err, loginData)
	}
	if loginData.User.FullName != "Integration User" {
		t.Fatalf("login full_name=%q want Integration User", loginData.User.FullName)
	}

	meReq := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginData.AccessToken)
	meRes := httptest.NewRecorder()
	app.router.ServeHTTP(meRes, meReq)
	if meRes.Code != http.StatusOK {
		t.Fatalf("/me status=%d body=%s", meRes.Code, meRes.Body.String())
	}
	var meEnv apiEnvelope
	_ = json.Unmarshal(meRes.Body.Bytes(), &meEnv)
	if !meEnv.Success || meEnv.Error != nil || !bytes.Contains(meEnv.Data, []byte("ada@example.com")) {
		t.Fatalf("/me did not return current user envelope: %s", meRes.Body.String())
	}

	badReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"credential":"ada@example.com","password":"wrong-password"}`)))
	badReq.Header.Set("Content-Type", "application/json")
	badRes := httptest.NewRecorder()
	app.router.ServeHTTP(badRes, badReq)
	if badRes.Code != http.StatusUnauthorized {
		t.Fatalf("invalid login status=%d body=%s", badRes.Code, badRes.Body.String())
	}
	var badEnv apiEnvelope
	_ = json.Unmarshal(badRes.Body.Bytes(), &badEnv)
	if badEnv.Success || badEnv.Error == nil || badEnv.Error.Code != "INVALID_CREDENTIALS" || string(badEnv.Data) != "null" {
		t.Fatalf("invalid login must use shared error envelope: %+v body=%s", badEnv, badRes.Body.String())
	}
}
