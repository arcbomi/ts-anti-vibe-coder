package exam

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"backend/pkg/sdk/events"
	"backend/pkg/sdk/queue"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	PreparationJobPending     = "pending"
	PreparationJobDownloading = "downloading"
	PreparationJobCompleted   = "completed"
	PreparationJobFailed      = "failed"

	RepoDownloadedEventName = "repo.downloaded.v1"
	RepoDownloadFailedEvent = "repo.download_failed.v1"
)

type PrepareSucceededProjectRequest struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
	AttemptID   string `json:"attempt_id"`
}

type PreparationJob struct {
	ID           string
	UserID       string
	ProjectSlug  string
	RepoURL      string
	AttemptID    string
	Status       string
	LocalPath    string
	CommitHash   string
	ErrorMessage string
	CreatedAt    time.Time
	CompletedAt  *time.Time
}

type PrepareSucceededProjectResponse struct {
	JobID       string `json:"job_id"`
	AttemptID   string `json:"attempt_id"`
	Status      string `json:"status"`
	ProjectSlug string `json:"project_slug"`
}

type RepoDownloadJobMessage struct {
	JobID       string `json:"job_id"`
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
	AttemptID   string `json:"attempt_id"`
	Attempt     int    `json:"attempt"`
}

func (m *RepoDownloadJobMessage) Validate() error {
	if _, err := uuid.Parse(strings.TrimSpace(m.JobID)); err != nil {
		return fmt.Errorf("job_id must be a uuid: %w", err)
	}
	if _, err := uuid.Parse(strings.TrimSpace(m.UserID)); err != nil {
		return fmt.Errorf("user_id must be a uuid: %w", err)
	}
	if _, err := uuid.Parse(strings.TrimSpace(m.AttemptID)); err != nil {
		return fmt.Errorf("attempt_id must be a uuid: %w", err)
	}
	if strings.TrimSpace(m.ProjectSlug) == "" {
		return fmt.Errorf("project_slug is required")
	}
	if strings.TrimSpace(m.RepoURL) == "" {
		return fmt.Errorf("repo_url is required")
	}
	if m.Attempt <= 0 {
		m.Attempt = 1
	}
	return nil
}

type RepoDownloadJobPublisher interface {
	PublishRepoDownloadJob(ctx context.Context, msg RepoDownloadJobMessage) error
}

type RedisRepoDownloadJobPublisher struct {
	redis *redis.Client
	queue string
}

func NewRedisRepoDownloadJobPublisher(redisClient *redis.Client, queueName string) *RedisRepoDownloadJobPublisher {
	if queueName == "" {
		queueName = "repo_download_jobs"
	}
	return &RedisRepoDownloadJobPublisher{redis: redisClient, queue: queueName}
}

func (p *RedisRepoDownloadJobPublisher) PublishRepoDownloadJob(ctx context.Context, msg RepoDownloadJobMessage) error {
	if p == nil || p.redis == nil {
		return fmt.Errorf("redis client is required")
	}
	if err := msg.Validate(); err != nil {
		return err
	}
	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return p.redis.LPush(ctx, p.queue, body).Err()
}

type RepoDownloadEvent struct {
	EventID      string `json:"event_id"`
	UserID       string `json:"user_id"`
	ProjectSlug  string `json:"project_slug"`
	AttemptID    string `json:"attempt_id"`
	RepoURL      string `json:"repo_url"`
	LocalPath    string `json:"local_path,omitempty"`
	CommitHash   string `json:"commit_hash,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
	OccurredAt   string `json:"occurred_at"`
}

type RepoDownloadProcessor struct {
	store      Store
	downloader RepoDownloader
	events     events.Publisher
	analysis   AnalysisJobPublisher
	preparer   QuestionPreparer
	log        *slog.Logger
	now        func() time.Time
}

func NewRepoDownloadProcessor(store Store, downloader RepoDownloader, publisher events.Publisher, analysis AnalysisJobPublisher, log *slog.Logger) *RepoDownloadProcessor {
	return NewRepoDownloadProcessorWithPreparer(store, downloader, publisher, analysis, nil, log)
}

func NewRepoDownloadProcessorWithPreparer(store Store, downloader RepoDownloader, publisher events.Publisher, analysis AnalysisJobPublisher, preparer QuestionPreparer, log *slog.Logger) *RepoDownloadProcessor {
	if log == nil {
		log = slog.Default()
	}
	return &RepoDownloadProcessor{
		store:      store,
		downloader: downloader,
		events:     publisher,
		analysis:   analysis,
		preparer:   preparer,
		log:        log,
		now:        func() time.Time { return time.Now().UTC() },
	}
}

func (p *RepoDownloadProcessor) Process(ctx context.Context, msg RepoDownloadJobMessage) error {
	if err := msg.Validate(); err != nil {
		return err
	}
	if err := p.store.MarkPreparationJobDownloading(ctx, msg.JobID); err != nil {
		return err
	}
	downloaded, err := p.downloader.Download(ctx, DownloadRepoRequest{
		UserID:      msg.UserID,
		ProjectSlug: msg.ProjectSlug,
		RepoURL:     msg.RepoURL,
		AttemptID:   msg.AttemptID,
	})
	if err != nil {
		occurredAt := p.now()
		_ = p.store.FailPreparationJob(ctx, msg.JobID, err.Error(), occurredAt)
		_ = p.publish(ctx, RepoDownloadFailedEvent, RepoDownloadEvent{
			EventID:      uuid.NewString(),
			UserID:       msg.UserID,
			ProjectSlug:  sanitizeProjectSlug(msg.ProjectSlug),
			AttemptID:    msg.AttemptID,
			RepoURL:      msg.RepoURL,
			ErrorMessage: err.Error(),
			OccurredAt:   occurredAt.Format(time.RFC3339),
		})
		return err
	}

	repo, err := p.store.UpsertSucceededProjectRepository(ctx, msg.UserID, msg.RepoURL, "")
	if err != nil {
		_ = p.store.FailPreparationJob(ctx, msg.JobID, "Unable to save downloaded repository.", p.now())
		return err
	}
	analysisJob, err := p.store.CreateRepositoryAnalysisJob(ctx, msg.UserID, repo.RepositoryID)
	if err != nil {
		_ = p.store.FailPreparationJob(ctx, msg.JobID, "Unable to create question preparation job.", p.now())
		return err
	}

	if err := p.store.CompletePreparationJob(ctx, msg.JobID, downloaded.LocalPath, downloaded.CommitHash, downloaded.DownloadedAt); err != nil {
		return err
	}

	if p.preparer != nil {
		if err := p.preparer.Prepare(ctx, QuestionPreparationRequest{
			AnalysisJobID: analysisJob.ID,
			UserID:        msg.UserID,
			RepositoryID:  repo.RepositoryID,
			RepoURL:       repo.RepoURL,
			Branch:        firstNonEmpty(repo.DefaultBranch, "main"),
			LocalPath:     downloaded.LocalPath,
		}); err != nil {
			_ = p.store.FailPreparationJob(ctx, msg.JobID, "Unable to generate exam questions.", p.now())
			_ = p.store.FailRepositoryAnalysisJob(ctx, analysisJob.ID, err.Error())
			return err
		}
	} else {
		if p.analysis == nil {
			_ = p.store.FailPreparationJob(ctx, msg.JobID, "Question preparation queue is not configured.", p.now())
			_ = p.store.FailRepositoryAnalysisJob(ctx, analysisJob.ID, "Question preparation queue is not configured.")
			return fmt.Errorf("analysis job publisher is required")
		}
		if err := p.analysis.PublishAnalysisJob(ctx, queue.AnalysisJobMessage{
			JobID:        analysisJob.ID,
			UserID:       msg.UserID,
			RepositoryID: repo.RepositoryID,
			GiteaRepoURL: repo.RepoURL,
			Branch:       firstNonEmpty(repo.DefaultBranch, "main"),
			Attempt:      1,
		}); err != nil {
			_ = p.store.FailPreparationJob(ctx, msg.JobID, "Unable to enqueue question preparation.", p.now())
			_ = p.store.FailRepositoryAnalysisJob(ctx, analysisJob.ID, "Unable to enqueue question preparation.")
			return err
		}
	}

	_ = p.publish(ctx, RepoDownloadedEventName, RepoDownloadEvent{
		EventID:     uuid.NewString(),
		UserID:      msg.UserID,
		ProjectSlug: sanitizeProjectSlug(msg.ProjectSlug),
		AttemptID:   msg.AttemptID,
		RepoURL:     msg.RepoURL,
		LocalPath:   downloaded.LocalPath,
		CommitHash:  downloaded.CommitHash,
		OccurredAt:  downloaded.DownloadedAt.Format(time.RFC3339),
	})
	return nil
}

func (p *RepoDownloadProcessor) publish(ctx context.Context, eventName string, payload RepoDownloadEvent) error {
	if p.events == nil {
		return nil
	}
	if err := p.events.Publish(ctx, eventName, payload); err != nil {
		p.log.Error("repo download event publish failed", "event_name", eventName, "attempt_id", payload.AttemptID, "err", err)
		return err
	}
	return nil
}

func validatePreparationRequest(req PrepareSucceededProjectRequest) error {
	if err := validateUUID(req.UserID, "user_id"); err != nil {
		return appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	if err := validateUUID(req.AttemptID, "attempt_id"); err != nil {
		return appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	if strings.TrimSpace(req.ProjectSlug) == "" {
		return appError(ErrCodeBadRequest, "project_slug is required", http.StatusBadRequest, nil)
	}
	if strings.TrimSpace(req.RepoURL) == "" {
		return appError(ErrCodeBadRequest, "repo_url is required", http.StatusBadRequest, nil)
	}
	return nil
}
