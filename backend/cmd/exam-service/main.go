package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	internalexam "backend/internal/exam"
	"backend/internal/tomorrow"
	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/config"
	"backend/pkg/sdk/database"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/middleware"
	"backend/pkg/sdk/queue"

	"github.com/go-chi/chi/v5"
)

func main() {
	cfg, err := config.LoadFromEnv("exam-service")
	if err != nil {
		panic(err)
	}
	log := logger.New(cfg.ServiceName, cfg.LogLevel)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	redisClient := queue.NewRedisClient(queue.RedisConfig{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB})
	defer func() { _ = redisClient.Close() }()

	store := internalexam.NewPostgresStore(db)
	if err := store.EnsureSchema(context.Background()); err != nil {
		log.Error("database schema initialization failed", "err", err)
		os.Exit(1)
	}

	repoPublisher := internalexam.NewRedisRepoDownloadJobPublisher(redisClient, cfg.RepoDownloadQueueName)
	analysisPublisher := queue.NewProducerWithQueue(redisClient, cfg.AnalysisQueueName)
	tomorrowBaseURL := cfg.TomorrowBaseURL
	var succeededProjectSource internalexam.SucceededProjectSource
	tomorrowClient, err := tomorrow.NewHTTPClient(tomorrow.HTTPClientConfig{
		BaseURL:    tomorrowBaseURL,
		Referrer:   cfg.TomorrowSchoolAuthReferrer,
		XJWTToken:  cfg.TomorrowSchoolAuthXJWTToken,
		SessionID:  cfg.TomorrowSchoolAuthSessionID,
		Timeout:    time.Duration(cfg.TomorrowSchoolAuthTimeoutSecs) * time.Second,
		HTTPClient: &http.Client{Timeout: time.Duration(cfg.TomorrowSchoolAuthTimeoutSecs) * time.Second},
	})
	if err == nil {
		succeededProjectSource = internalexam.NewTomorrowSucceededProjectSource(tomorrowClient, tomorrowBaseURL)
	} else {
		log.Warn("tomorrow succeeded project sync disabled", "err", err)
	}
	service := internalexam.NewServiceWithProjectPreparation(store, cfg.ExamPassScore, cfg.ExamOpenDOW, repoPublisher, succeededProjectSource, analysisPublisher)
	handler := internalexam.NewHandler(service, cfg.InternalServiceToken)
	validator, err := authn.NewValidator(cfg.JWTSecret)
	if err != nil {
		log.Error("jwt validator initialization failed", "err", err)
		os.Exit(1)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	r.Use(middleware.RequestLogger(log))
	r.Use(middleware.Recoverer(log))
	r.Use(middleware.CORS())
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	r.Mount("/", internalexam.NewRouter(handler, validator))

	srv := &http.Server{Addr: cfg.HTTPAddr(), Handler: r, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Info("http server started", "addr", cfg.HTTPAddr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("http server failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Info("shutdown complete")
}
