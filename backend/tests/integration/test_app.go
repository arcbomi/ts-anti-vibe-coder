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

	"backend/internal/analysis"
	"backend/internal/auth"
	"backend/internal/exam"
	giteasvc "backend/internal/gitea"
	"backend/internal/question"
	"backend/internal/tomorrow"
	"backend/internal/worker"
	"backend/pkg/sdk/aiclient"
	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/events"
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
	authRepo := auth.NewRepository(db)
	giteaClient := giteaclient.New(fakeGitea.URL(), "server-userbot-token")
	publisher := queue.NewProducer(redisClient)
	giteaService := giteasvc.NewService(
		giteasvc.NewPostgresStore(db),
		giteasvc.NewValidator(fakeGitea.URL()),
		giteaClient,
		publisher,
		giteasvc.NewFileFilter(0),
		"https://01.tomorrow-school.ai",
		fakeTomorrowProfileClient{},
		integrationTomorrowConnectionStore{repo: authRepo},
		log,
	)
	examStore := exam.NewPostgresStore(db)
	repoPublisher := exam.NewRedisRepoDownloadJobPublisher(redisClient, "repo_download_jobs")
	analysisPublisher := queue.NewProducerWithQueue(redisClient, "analysis_jobs")
	examService := exam.NewServiceWithProjectPreparation(
		examStore,
		14,
		"Friday",
		repoPublisher,
		exam.NewTomorrowSucceededProjectSource(integrationTomorrowClient{profile: fakeTomorrowProfileClient{}}, "https://01.tomorrow-school.ai"),
		analysisPublisher,
	)
	questionService := question.NewService(question.NewPostgresStore(db))

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	auth.NewHandler(authService).RegisterRoutes(r)
	giteaRoutes := giteasvc.NewHandler(giteaService).Routes()
	examRoutes := exam.NewRouter(exam.NewHandler(examService, "internal-test-token"), validator)
	questionRoutes := question.NewRouter(question.NewHandler(questionService, "internal-test-token"), validator)

	r.With(middleware.RequireJWTIdentity(validator)).Handle("/repositories", giteaRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/repositories/*", giteaRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/analysis-jobs/{id}", giteaRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/succeeded-projects", examRoutes)
	r.With(middleware.RequireJWTIdentity(validator)).Handle("/succeeded-projects/*", examRoutes)
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

type fakeTomorrowProfileClient struct{}

func (fakeTomorrowProfileClient) FetchProfilePage(context.Context, tomorrow.Session, string) (string, error) {
	return `<html><body><article><h3>go-reloaded</h3><p>Project succeeded</p><p>5 peer audits required</p></article></body></html>`, nil
}

type integrationTomorrowConnectionStore struct {
	repo *auth.Repository
}

func (s integrationTomorrowConnectionStore) GetTomorrowConnection(ctx context.Context, userID string) (giteasvc.TomorrowConnection, error) {
	connection, err := s.repo.GetTomorrowConnection(ctx, userID)
	if err != nil {
		return giteasvc.TomorrowConnection{}, err
	}
	return giteasvc.TomorrowConnection{
		Username:    connection.Username,
		RemoteToken: connection.RemoteToken,
		ProfilePath: connection.ProfilePath,
	}, nil
}

type integrationTomorrowClient struct {
	profile fakeTomorrowProfileClient
}

func (c integrationTomorrowClient) Login(context.Context, string, string) (tomorrow.Session, error) {
	return tomorrow.Session{JWT: "integration-remote-jwt"}, nil
}

func (c integrationTomorrowClient) FetchProfilePage(ctx context.Context, session tomorrow.Session, profileURL string) (string, error) {
	return c.profile.FetchProfilePage(ctx, session, profileURL)
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

func (a *testApp) runOneRepoDownloadJob(t *testing.T, downloader exam.RepoDownloader) {
	t.Helper()
	result, err := a.redis.BRPop(context.Background(), time.Second, "repo_download_jobs").Result()
	if err != nil || len(result) != 2 {
		t.Fatalf("expected queued repo download job message: result=%v err=%v", result, err)
	}
	processor := exam.NewRepoDownloadProcessor(
		exam.NewPostgresStore(a.db),
		downloader,
		events.NewRedisPublisher(a.redis),
		queue.NewProducerWithQueue(a.redis, "analysis_jobs"),
		logger.New("integration-repo-download-worker"),
	)
	processor = exam.NewRepoDownloadProcessorWithPreparer(
		exam.NewPostgresStore(a.db),
		downloader,
		events.NewRedisPublisher(a.redis),
		queue.NewProducerWithQueue(a.redis, "analysis_jobs"),
		exam.NewLocalQuestionPreparer(
			exam.NewPostgresStore(a.db),
			analysis.NewService(aiclient.New(a.ai.URL(), "fake-key", "fake-model", aiclient.WithRetries(0), aiclient.WithTimeout(2*time.Second))),
			logger.New("integration-repo-download-worker"),
		),
		logger.New("integration-repo-download-worker"),
	)
	var msg exam.RepoDownloadJobMessage
	if err := json.Unmarshal([]byte(result[1]), &msg); err != nil {
		t.Fatalf("unmarshal repo download job message: %v", err)
	}
	if err := processor.Process(context.Background(), msg); err != nil {
		t.Fatalf("repo download worker failed to process job: %v", err)
	}
}

func (a *testApp) runOneRepoDownloadJobAllowError(t *testing.T, downloader exam.RepoDownloader) {
	t.Helper()
	result, err := a.redis.BRPop(context.Background(), time.Second, "repo_download_jobs").Result()
	if err != nil || len(result) != 2 {
		t.Fatalf("expected queued repo download job message: result=%v err=%v", result, err)
	}
	processor := exam.NewRepoDownloadProcessor(
		exam.NewPostgresStore(a.db),
		downloader,
		events.NewRedisPublisher(a.redis),
		queue.NewProducerWithQueue(a.redis, "analysis_jobs"),
		logger.New("integration-repo-download-worker"),
	)
	processor = exam.NewRepoDownloadProcessorWithPreparer(
		exam.NewPostgresStore(a.db),
		downloader,
		events.NewRedisPublisher(a.redis),
		queue.NewProducerWithQueue(a.redis, "analysis_jobs"),
		exam.NewLocalQuestionPreparer(
			exam.NewPostgresStore(a.db),
			analysis.NewService(aiclient.New(a.ai.URL(), "fake-key", "fake-model", aiclient.WithRetries(0), aiclient.WithTimeout(2*time.Second))),
			logger.New("integration-repo-download-worker"),
		),
		logger.New("integration-repo-download-worker"),
	)
	var msg exam.RepoDownloadJobMessage
	if err := json.Unmarshal([]byte(result[1]), &msg); err != nil {
		t.Fatalf("unmarshal repo download job message: %v", err)
	}
	_ = processor.Process(context.Background(), msg)
}

type apiEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}
