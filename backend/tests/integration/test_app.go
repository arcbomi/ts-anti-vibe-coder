//go:build integration
// +build integration

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
	"backend/internal/question"
	"backend/internal/worker"
	"backend/pkg/sdk/aiclient"
	"backend/pkg/sdk/authn"
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
	authTokens, err := auth.NewTokenManager(integrationJWTSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	validator, err := authn.NewValidator(integrationJWTSecret)
	if err != nil {
		t.Fatal(err)
	}
	authService := auth.NewService(auth.NewRepository(db), authTokens)
	gitlabClient := gitlabclient.New(fakeGitLab.URL(), "server-userbot-token")
	publisher := queue.NewProducer(redisClient)
	gitlabService := gitlabsvc.NewService(gitlabsvc.NewPostgresStore(db), gitlabsvc.NewValidator(fakeGitLab.URL()), gitlabClient, publisher, gitlabsvc.NewFileFilter(0), log)
	examService := exam.NewService(exam.NewPostgresStore(db), 70, "Friday")
	questionService := question.NewService(question.NewPostgresStore(db))

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	auth.NewHandler(authService).RegisterRoutes(r)
	gitlabRoutes := gitlabsvc.NewHandler(gitlabService).Routes()
	examRoutes := exam.NewRouter(exam.NewHandler(examService), validator)
	questionRoutes := question.NewRouter(question.NewHandler(questionService, "internal-test-token"), validator)

	r.With(middleware.RequireJWTIdentity(validator)).Handle("/repositories", gitlabRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/repositories/*", gitlabRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/analysis-jobs/{id}", gitlabRoutes)
	r.Handle("/analysis-jobs/{id}/questions", questionRoutes)
	r.Handle("/exams", examRoutes)
	r.Handle("/exams/*", examRoutes)
	r.Handle("/questions/generated", questionRoutes)
	r.Handle("/internal/exams/{examId}/answer-key", questionRoutes)

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
