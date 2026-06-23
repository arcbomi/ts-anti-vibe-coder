package gitea

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend/internal/auth"
	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/middleware"
)

func TestRoutesGetAnalysisJob(t *testing.T) {
	service := &stubService{
		job: &AnalysisJob{
			ID:           "7c9b5ea7-8cbb-4a55-9cf4-5d711b8c8e38",
			UserID:       "00000000-0000-0000-0000-000000000001",
			RepositoryID: "8ecf991f-25a6-4142-8671-7f7f17ee09ef",
			Status:       "completed",
			CreatedAt:    time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC),
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/analysis-jobs/"+service.job.ID, nil)
	req.Header.Set("Authorization", "Bearer "+issueToken(t, service.job.UserID))
	rec := httptest.NewRecorder()

	validator, err := authn.NewValidator("gitea-handler-test-secret")
	if err != nil {
		t.Fatal(err)
	}
	middleware.RequireJWTIdentity(validator)(NewHandler(service).Routes()).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool        `json:"success"`
		Data    AnalysisJob `json:"data"`
		Error   any         `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !payload.Success || payload.Error != nil {
		t.Fatalf("unexpected envelope: %+v", payload)
	}
	if payload.Data.ID != service.job.ID || payload.Data.Status != service.job.Status {
		t.Fatalf("unexpected data: %+v", payload.Data)
	}
	var raw struct {
		Success bool `json:"success"`
		Data    struct {
			ID            string `json:"id"`
			AnalysisJobID string `json:"analysis_job_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("unmarshal raw response: %v", err)
	}
	if raw.Data.ID != service.job.ID || raw.Data.AnalysisJobID != service.job.ID {
		t.Fatalf("expected both id fields to match job id, got %+v", raw.Data)
	}
	if service.lastUserID != service.job.UserID || service.lastAnalysisJobID != service.job.ID {
		t.Fatalf("service called with user=%q job=%q", service.lastUserID, service.lastAnalysisJobID)
	}
}

func TestRoutesGetRepositoryIncludesLatestAnalysisJobID(t *testing.T) {
	latestAnalysisJobID := "7c9b5ea7-8cbb-4a55-9cf4-5d711b8c8e38"
	latestAnalysisStatus := "reading_repository"
	service := &stubService{
		repo: &Repository{
			ID:                   "8ecf991f-25a6-4142-8671-7f7f17ee09ef",
			UserID:               "00000000-0000-0000-0000-000000000001",
			GiteaRepoURL:         "https://gitea.com/group/project",
			BotAccessStatus:      "granted",
			LatestAnalysisJobID:  &latestAnalysisJobID,
			LatestAnalysisStatus: &latestAnalysisStatus,
			CreatedAt:            time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC),
			UpdatedAt:            time.Date(2026, 6, 3, 13, 0, 0, 0, time.UTC),
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/repositories/"+service.repo.ID, nil)
	req.Header.Set("Authorization", "Bearer "+issueToken(t, service.repo.UserID))
	rec := httptest.NewRecorder()

	validator, err := authn.NewValidator("gitea-handler-test-secret")
	if err != nil {
		t.Fatal(err)
	}
	middleware.RequireJWTIdentity(validator)(NewHandler(service).Routes()).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			ID                   string `json:"id"`
			LatestAnalysisJobID  string `json:"latest_analysis_job_id"`
			LatestAnalysisStatus string `json:"latest_analysis_status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload.Data.ID != service.repo.ID || payload.Data.LatestAnalysisJobID != latestAnalysisJobID || payload.Data.LatestAnalysisStatus != latestAnalysisStatus {
		t.Fatalf("unexpected data: %+v", payload.Data)
	}
}

func TestRoutesListRepositories(t *testing.T) {
	latestAnalysisStatus := "failed"
	service := &stubService{
		repositories: []Repository{
			{
				ID:                   "8ecf991f-25a6-4142-8671-7f7f17ee09ef",
				UserID:               "00000000-0000-0000-0000-000000000001",
				GiteaRepoURL:         "https://gitea.com/group/project",
				BotAccessStatus:      "denied",
				LatestAnalysisStatus: &latestAnalysisStatus,
				CreatedAt:            time.Date(2026, 6, 3, 12, 0, 0, 0, time.UTC),
				UpdatedAt:            time.Date(2026, 6, 3, 13, 0, 0, 0, time.UTC),
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/repositories", nil)
	req.Header.Set("Authorization", "Bearer "+issueToken(t, "00000000-0000-0000-0000-000000000001"))
	rec := httptest.NewRecorder()

	validator, err := authn.NewValidator("gitea-handler-test-secret")
	if err != nil {
		t.Fatal(err)
	}
	middleware.RequireJWTIdentity(validator)(NewHandler(service).Routes()).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Success bool `json:"success"`
		Data    []struct {
			ID                   string `json:"id"`
			GiteaRepoURL         string `json:"gitea_repo_url"`
			LatestAnalysisStatus string `json:"latest_analysis_status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !payload.Success || len(payload.Data) != 1 {
		t.Fatalf("unexpected payload: %+v", payload)
	}
	if payload.Data[0].ID != service.repositories[0].ID || payload.Data[0].LatestAnalysisStatus != latestAnalysisStatus {
		t.Fatalf("unexpected repository payload: %+v", payload.Data[0])
	}
	if len(service.listedUserIDs) != 1 || service.listedUserIDs[0] != "00000000-0000-0000-0000-000000000001" {
		t.Fatalf("list user ids = %v", service.listedUserIDs)
	}
}

type stubService struct {
	repo              *Repository
	repositories      []Repository
	job               *AnalysisJob
	lastUserID        string
	lastAnalysisJobID string
	listedUserIDs     []string
}

func (s *stubService) CreateRepository(context.Context, string, string) (*Repository, error) {
	panic("unexpected call")
}

func (s *stubService) ListRepositories(_ context.Context, userID string) ([]Repository, error) {
	s.listedUserIDs = append(s.listedUserIDs, userID)
	return s.repositories, nil
}

func (s *stubService) SyncTomorrowProjects(_ context.Context, userID string) ([]Repository, error) {
	s.listedUserIDs = append(s.listedUserIDs, userID)
	return s.repositories, nil
}

func (s *stubService) CheckBotAccess(context.Context, string, string) (*Repository, error) {
	panic("unexpected call")
}

func (s *stubService) StartAnalysis(context.Context, string, string) (*AnalysisJob, error) {
	panic("unexpected call")
}

func (s *stubService) GetRepository(_ context.Context, _ string, _ string) (*Repository, error) {
	return s.repo, nil
}

func (s *stubService) GetAnalysisJob(_ context.Context, userID string, analysisJobID string) (*AnalysisJob, error) {
	s.lastUserID = userID
	s.lastAnalysisJobID = analysisJobID
	return s.job, nil
}

func (s *stubService) ReadSafeRepositoryFiles(context.Context, string, string) (*SafeRepositorySnapshot, error) {
	panic("unexpected call")
}

func issueToken(t *testing.T, userID string) string {
	t.Helper()
	tm, err := auth.NewTokenManager("gitea-handler-test-secret", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	token, err := tm.Generate(auth.User{
		ID:    userID,
		Email: "student@example.com",
		Name:  "Student User",
	})
	if err != nil {
		t.Fatal(err)
	}
	return token
}
