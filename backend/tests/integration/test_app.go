package integration

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"backend/internal/auth"
	"backend/internal/exam"
	gitlabsvc "backend/internal/gitlab"
	"backend/internal/worker"
	"backend/pkg/sdk/aiclient"
	"backend/pkg/sdk/gitlabclient"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/middleware"
	"backend/pkg/sdk/queue"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
)

type testApp struct {
	db     *sql.DB
	redis  *redis.Client
	gitlab *fakeGitLabServer
	ai     *fakeAIServer
	router http.Handler
}

func newTestApp(t *testing.T) *testApp {
	t.Helper()
	db := openTestDatabase(t)
	redisClient := openTestRedis(t)
	fakeGitLab := newFakeGitLabServer()
	fakeAI := newFakeAIServer()
	t.Cleanup(fakeGitLab.Close)
	t.Cleanup(fakeAI.Close)

	log := logger.New("integration-test")
	authTokens, err := auth.NewTokenManager("integration-test-jwt-secret", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	authService := auth.NewService(auth.NewRepository(db), authTokens)
	gitlabClient := gitlabclient.New(fakeGitLab.URL(), "server-userbot-token")
	publisher := queue.NewProducer(redisClient)
	gitlabService := gitlabsvc.NewService(gitlabsvc.NewPostgresStore(db), gitlabsvc.NewValidator(fakeGitLab.URL()), gitlabClient, publisher, gitlabsvc.NewFileFilter(0), log)
	examService := exam.NewService(exam.NewPostgresStore(db), 70, "Friday")

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	auth.NewHandler(authService).RegisterRoutes(r)
	r.Mount("/", gitlabsvc.NewHandler(gitlabService).Routes())
	r.Mount("/", exam.NewRouter(exam.NewHandler(examService)))
	r.Get("/analysis-jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		var resp struct {
			Success bool `json:"success"`
			Data    any  `json:"data"`
			Error   any  `json:"error"`
		}
		job := map[string]any{}
		var completedAt sql.NullTime
		var errorMessage sql.NullString
		var errorCode sql.NullString
		row := db.QueryRowContext(r.Context(), `SELECT id::text, user_id::text, repository_id::text, status, error_message, error_code, created_at, completed_at FROM analysis_jobs WHERE id = $1`, chi.URLParam(r, "id"))
		var id, userID, repositoryID, status string
		var createdAt time.Time
		if err := row.Scan(&id, &userID, &repositoryID, &status, &errorMessage, &errorCode, &createdAt, &completedAt); err != nil {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "data": nil, "error": map[string]string{"code": "ANALYSIS_JOB_NOT_FOUND", "message": "Analysis job not found."}})
			return
		}
		job["id"] = id
		job["analysis_job_id"] = id
		job["user_id"] = userID
		job["repository_id"] = repositoryID
		job["status"] = status
		job["created_at"] = createdAt
		if completedAt.Valid {
			job["completed_at"] = completedAt.Time
		}
		if errorMessage.Valid {
			job["error_message"] = errorMessage.String
		}
		if errorCode.Valid {
			job["error_code"] = errorCode.String
		}
		resp.Success = true
		resp.Data = job
		resp.Error = nil
		_ = json.NewEncoder(w).Encode(resp)
	})

	return &testApp{db: db, redis: redisClient, gitlab: fakeGitLab, ai: fakeAI, router: r}
}

func (a *testApp) runOneWorkerJob(t *testing.T) {
	t.Helper()
	result, err := a.redis.BRPop(context.Background(), time.Second, "analysis_jobs").Result()
	if err != nil || len(result) != 2 {
		t.Fatalf("expected queued analysis job message: result=%v err=%v", result, err)
	}
	runner := worker.NewJobRunner(worker.NewPostgresStore(a.db), gitlabclient.New(a.gitlab.URL(), "server-userbot-token"), aiclient.New(a.ai.URL(), "fake-key", "fake-model", aiclient.WithRetries(0), aiclient.WithTimeout(2*time.Second)), logger.New("integration-worker"))
	handler := worker.NewHandler(runner, worker.NewPostgresStore(a.db), logger.New("integration-worker"))
	res := handler.Handle(context.Background(), []byte(result[1]))
	if res.Err != nil {
		t.Fatalf("worker failed to process analysis job: %v", res.Err)
	}
}

func (a *testApp) runOneWorkerJobAllowError(t *testing.T) {
	t.Helper()
	result, err := a.redis.BRPop(context.Background(), time.Second, "analysis_jobs").Result()
	if err != nil || len(result) != 2 {
		t.Fatalf("expected queued analysis job message: result=%v err=%v", result, err)
	}
	runner := worker.NewJobRunner(worker.NewPostgresStore(a.db), gitlabclient.New(a.gitlab.URL(), "server-userbot-token"), aiclient.New(a.ai.URL(), "fake-key", "fake-model", aiclient.WithRetries(0), aiclient.WithTimeout(2*time.Second)), logger.New("integration-worker"))
	handler := worker.NewHandler(runner, worker.NewPostgresStore(a.db), logger.New("integration-worker"))
	_ = handler.Handle(context.Background(), []byte(result[1]))
}

type apiEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}
