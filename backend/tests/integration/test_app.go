//go:build integration
// +build integration

package integration

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"backend/internal/auth"
	"backend/internal/exam"
	giteasvc "backend/internal/gitea"
	"backend/internal/question"
	"backend/internal/worker"
	"backend/pkg/sdk/aiclient"
	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/giteaclient"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/middleware"
	"backend/pkg/sdk/queue"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
)

type testApp struct {
	db     *sql.DB
	redis  *redis.Client
	gitea  *fakeGiteaServer
	ai     *fakeAIServer
	router http.Handler
}

func newTestApp(t *testing.T) *testApp {
	t.Helper()
	db := openTestDatabase(t)
	redisClient := openTestRedis(t)
	fakeGitea := newFakeGiteaServer()
	fakeAI := newFakeAIServer()
	t.Cleanup(fakeGitea.Close)
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
	authService := auth.NewService(auth.NewRepository(db), authTokens, integrationAuthenticator{}, log)
	giteaClient := giteaclient.New(fakeGitea.URL(), "server-userbot-token")
	publisher := queue.NewProducer(redisClient)
	giteaService := giteasvc.NewService(giteasvc.NewPostgresStore(db), giteasvc.NewValidator(fakeGitea.URL()), giteaClient, publisher, giteasvc.NewFileFilter(0), log)
	examService := exam.NewService(exam.NewPostgresStore(db), 70, "Friday")
	questionService := question.NewService(question.NewPostgresStore(db))

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	auth.NewHandler(authService).RegisterRoutes(r)
	giteaRoutes := giteasvc.NewHandler(giteaService).Routes()
	examRoutes := exam.NewRouter(exam.NewHandler(examService), validator)
	questionRoutes := question.NewRouter(question.NewHandler(questionService, "internal-test-token"), validator)

	r.With(middleware.RequireJWTIdentity(validator)).Handle("/repositories", giteaRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/repositories/*", giteaRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/analysis-jobs/{id}", giteaRoutes)
	r.Handle("/analysis-jobs/{id}/questions", questionRoutes)
	r.Handle("/exams", examRoutes)
	r.Handle("/exams/*", examRoutes)
	r.Handle("/questions/generated", questionRoutes)
	r.Handle("/internal/exams/{examId}/answer-key", questionRoutes)

	return &testApp{db: db, redis: redisClient, gitea: fakeGitea, ai: fakeAI, router: r}
}

type integrationAuthenticator struct{}

func (integrationAuthenticator) Authenticate(_ context.Context, credential, password string) (auth.ExternalIdentity, error) {
	if password != "correct-password" {
		return auth.ExternalIdentity{}, auth.ErrInvalidCredentials
	}
	email := credential
	if !strings.Contains(email, "@") {
		email = credential + "@example.com"
	}
	return auth.ExternalIdentity{Email: email, Username: credential, Name: credential, FullName: "Integration User", RemoteToken: "integration-remote-jwt"}, nil
}

func (a *testApp) runOneWorkerJob(t *testing.T) {
	t.Helper()
	result, err := a.redis.BRPop(context.Background(), time.Second, "analysis_jobs").Result()
	if err != nil || len(result) != 2 {
		t.Fatalf("expected queued analysis job message: result=%v err=%v", result, err)
	}
	runner := worker.NewJobRunner(worker.NewPostgresStore(a.db), giteaclient.New(a.gitea.URL(), "server-userbot-token"), aiclient.New(a.ai.URL(), "fake-key", "fake-model", aiclient.WithRetries(0), aiclient.WithTimeout(2*time.Second)), logger.New("integration-worker"))
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
	runner := worker.NewJobRunner(worker.NewPostgresStore(a.db), giteaclient.New(a.gitea.URL(), "server-userbot-token"), aiclient.New(a.ai.URL(), "fake-key", "fake-model", aiclient.WithRetries(0), aiclient.WithTimeout(2*time.Second)), logger.New("integration-worker"))
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
