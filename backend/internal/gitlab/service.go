package gitlab

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"backend/pkg/sdk/gitlabclient"
	"backend/pkg/sdk/logger"
	"backend/pkg/sdk/queue"

	"github.com/google/uuid"
)

type GitLabClient interface {
	CheckAccess(ctx context.Context, repoURL string) (bool, error)
	GetRepository(ctx context.Context, repoURL string) (gitlabclient.Repository, error)
	GetRepositoryTree(ctx context.Context, repoURL string, branch string) ([]gitlabclient.TreeNode, error)
	GetFileContent(ctx context.Context, repoURL string, filePath string, branch string) ([]byte, error)
}

type QueuePublisher interface {
	PublishAnalysisJob(ctx context.Context, msg queue.AnalysisJobMessage) error
}

type Service interface {
	CreateRepository(ctx context.Context, userID string, repoURL string) (*Repository, error)
	CheckBotAccess(ctx context.Context, userID string, repositoryID string) (*Repository, error)
	StartAnalysis(ctx context.Context, userID string, repositoryID string) (*AnalysisJob, error)
	GetRepository(ctx context.Context, userID string, repositoryID string) (*Repository, error)
	GetAnalysisJob(ctx context.Context, userID string, analysisJobID string) (*AnalysisJob, error)
	ReadSafeRepositoryFiles(ctx context.Context, userID string, repositoryID string) (*SafeRepositorySnapshot, error)
}

type ReaderService struct {
	store     Store
	validator *Validator
	gitlab    GitLabClient
	queue     QueuePublisher
	filter    FileFilter
	log       *slog.Logger
	timeout   time.Duration
}

func NewService(store Store, validator *Validator, gl GitLabClient, publisher QueuePublisher, filter FileFilter, log *slog.Logger) *ReaderService {
	if log == nil {
		log = logger.New("gitlab-reader-service")
	}
	return &ReaderService{store: store, validator: validator, gitlab: gl, queue: publisher, filter: filter, log: log, timeout: 15 * time.Second}
}

func (s *ReaderService) CreateRepository(ctx context.Context, userID string, repoURL string) (*Repository, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	normalized, err := s.validator.Normalize(repoURL)
	if err != nil {
		return nil, appError(ErrCodeInvalidRepositoryURL, "The repository URL is invalid.", http.StatusBadRequest, err)
	}
	repo := &Repository{
		ID:                uuid.NewString(),
		UserID:            userID,
		GitLabRepoURL:     normalized.URL,
		GitLabProjectPath: normalized.ProjectPath,
		DefaultBranch:     "main",
		BotAccessStatus:   BotAccessUnknown,
	}
	if err := s.store.CreateRepository(ctx, repo); err != nil {
		return nil, appError(ErrCodeInternal, "Unable to save repository.", http.StatusInternalServerError, err)
	}
	return repo, nil
}

func (s *ReaderService) CheckBotAccess(ctx context.Context, userID string, repositoryID string) (*Repository, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	repo, err := s.GetRepository(ctx, userID, repositoryID)
	if err != nil {
		return nil, err
	}
	_, _ = s.store.UpdateBotAccess(ctx, userID, repositoryID, BotAccessChecking, repo.DefaultBranch)

	apiCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	access, err := s.gitlab.CheckAccess(apiCtx, repo.GitLabRepoURL)
	if err != nil {
		_, _ = s.store.UpdateBotAccess(ctx, userID, repositoryID, BotAccessFailed, repo.DefaultBranch)
		s.log.Error("gitlab access check failed", "repository_id", repositoryID, "request_id", logger.RequestIDFromContext(ctx), "err", err)
		return nil, appError(ErrCodeGitLabAPIError, "Unable to check GitLab repository access.", http.StatusBadGateway, err)
	}
	if !access {
		_, _ = s.store.UpdateBotAccess(ctx, userID, repositoryID, BotAccessDenied, repo.DefaultBranch)
		return nil, appError(ErrCodeBotAccessDenied, "The GitLab bot does not have access to this repository. Please add the bot as a collaborator and try again.", http.StatusForbidden, nil)
	}

	meta, err := s.gitlab.GetRepository(apiCtx, repo.GitLabRepoURL)
	if err != nil {
		_, _ = s.store.UpdateBotAccess(ctx, userID, repositoryID, BotAccessFailed, repo.DefaultBranch)
		return nil, appError(ErrCodeGitLabAPIError, "Unable to read GitLab repository metadata.", http.StatusBadGateway, err)
	}
	branch := meta.DefaultBranch
	if branch == "" {
		branch = "main"
	}
	updated, err := s.store.UpdateBotAccess(ctx, userID, repositoryID, BotAccessGranted, branch)
	if err != nil {
		return nil, mapStoreError(err)
	}
	return updated, nil
}

func (s *ReaderService) StartAnalysis(ctx context.Context, userID string, repositoryID string) (*AnalysisJob, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	repo, err := s.GetRepository(ctx, userID, repositoryID)
	if err != nil {
		return nil, err
	}
	if repo.BotAccessStatus != BotAccessGranted {
		return nil, appError(ErrCodeBotAccessDenied, "The GitLab bot does not have access to this repository. Please add the bot as a collaborator and try again.", http.StatusForbidden, nil)
	}

	job := &AnalysisJob{ID: uuid.NewString(), UserID: userID, RepositoryID: repositoryID, Status: AnalysisJobPending}
	if err := s.store.CreateAnalysisJob(ctx, job); err != nil {
		return nil, appError(ErrCodeInternal, "Unable to create analysis job.", http.StatusInternalServerError, err)
	}
	msg := queue.AnalysisJobMessage{JobID: job.ID, UserID: userID, RepositoryID: repositoryID, GitLabRepoURL: repo.GitLabRepoURL, Branch: repo.DefaultBranch}
	if msg.Branch == "" {
		msg.Branch = "main"
	}
	if err := s.queue.PublishAnalysisJob(ctx, msg); err != nil {
		if failErr := s.store.FailAnalysisJob(ctx, userID, job.ID, "Unable to enqueue analysis job."); failErr != nil {
			s.log.Error("analysis job failure status update failed", "repository_id", repositoryID, "job_id", job.ID, "request_id", logger.RequestIDFromContext(ctx), "err", failErr)
		}
		s.log.Error("analysis job publish failed", "repository_id", repositoryID, "job_id", job.ID, "request_id", logger.RequestIDFromContext(ctx), "err", err)
		return nil, appError(ErrCodeQueuePublishFailed, "Unable to enqueue analysis job.", http.StatusBadGateway, err)
	}
	return job, nil
}

func (s *ReaderService) GetRepository(ctx context.Context, userID string, repositoryID string) (*Repository, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	if _, err := uuid.Parse(repositoryID); err != nil {
		return nil, appError(ErrCodeRepositoryNotFound, "Repository not found.", http.StatusNotFound, err)
	}
	repo, err := s.store.GetRepository(ctx, userID, repositoryID)
	if err != nil {
		return nil, mapStoreError(err)
	}
	return repo, nil
}

func (s *ReaderService) GetAnalysisJob(ctx context.Context, userID string, analysisJobID string) (*AnalysisJob, error) {
	if err := validateUserID(userID); err != nil {
		return nil, err
	}
	if _, err := uuid.Parse(analysisJobID); err != nil {
		return nil, appError("ANALYSIS_JOB_NOT_FOUND", "Analysis job not found.", http.StatusNotFound, err)
	}
	job, err := s.store.GetAnalysisJob(ctx, userID, analysisJobID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, appError("ANALYSIS_JOB_NOT_FOUND", "Analysis job not found.", http.StatusNotFound, err)
		}
		return nil, appError(ErrCodeInternal, "Internal server error.", http.StatusInternalServerError, err)
	}
	return job, nil
}

func (s *ReaderService) ReadSafeRepositoryFiles(ctx context.Context, userID string, repositoryID string) (*SafeRepositorySnapshot, error) {
	repo, err := s.GetRepository(ctx, userID, repositoryID)
	if err != nil {
		return nil, err
	}
	if repo.BotAccessStatus != BotAccessGranted {
		return nil, appError(ErrCodeBotAccessDenied, "The GitLab bot does not have access to this repository. Please add the bot as a collaborator and try again.", http.StatusForbidden, nil)
	}
	branch := repo.DefaultBranch
	if branch == "" {
		branch = "main"
	}

	apiCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()
	tree, err := s.gitlab.GetRepositoryTree(apiCtx, repo.GitLabRepoURL, branch)
	if err != nil {
		return nil, appError(ErrCodeGitLabAPIError, "Unable to read GitLab repository tree.", http.StatusBadGateway, err)
	}

	snapshot := &SafeRepositorySnapshot{RepositoryID: repositoryID, Branch: branch}
	for _, node := range tree {
		if node.Type != "blob" || !s.filter.ShouldReadPath(node.Path) {
			continue
		}
		content, err := s.gitlab.GetFileContent(apiCtx, repo.GitLabRepoURL, node.Path, branch)
		if err != nil || !s.filter.ShouldReadContent(content) {
			continue
		}
		snapshot.Files = append(snapshot.Files, SafeRepositoryFile{Path: node.Path, Size: len(content), Content: string(content)})
	}
	return snapshot, nil
}

func validateUserID(userID string) error {
	if _, err := uuid.Parse(userID); err != nil {
		return appError(ErrCodeUnauthorized, "Authenticated user id is required.", http.StatusUnauthorized, err)
	}
	return nil
}

func mapStoreError(err error) error {
	if errors.Is(err, ErrNotFound) {
		return appError(ErrCodeRepositoryNotFound, "Repository not found.", http.StatusNotFound, err)
	}
	return appError(ErrCodeInternal, "Internal server error.", http.StatusInternalServerError, err)
}

func appError(code string, message string, status int, cause error) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: status, Cause: cause}
}
