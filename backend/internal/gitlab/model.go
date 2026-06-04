package gitlab

import (
	"errors"
	"time"
)

const (
	BotAccessUnknown  = "unknown"
	BotAccessChecking = "checking"
	BotAccessGranted  = "granted"
	BotAccessDenied   = "denied"
	BotAccessFailed   = "failed"

	AnalysisJobPending = "pending"
)

const (
	ErrCodeInvalidRepositoryURL = "INVALID_REPOSITORY_URL"
	ErrCodeRepositoryNotFound   = "REPOSITORY_NOT_FOUND"
	ErrCodeBotAccessDenied      = "BOT_ACCESS_DENIED"
	ErrCodeGitLabAPIError       = "GITLAB_API_ERROR"
	ErrCodeQueuePublishFailed   = "QUEUE_PUBLISH_FAILED"
	ErrCodeUnauthorized         = "UNAUTHORIZED"
	ErrCodeInternal             = "INTERNAL_ERROR"
)

var ErrNotFound = errors.New("repository not found")

type Repository struct {
	ID                  string    `json:"id"`
	UserID              string    `json:"user_id,omitempty"`
	GitLabRepoURL       string    `json:"gitlab_repo_url"`
	GitLabProjectPath   string    `json:"gitlab_project_path,omitempty"`
	DefaultBranch       string    `json:"default_branch,omitempty"`
	BotAccessStatus     string    `json:"bot_access_status"`
	LatestAnalysisJobID *string   `json:"latest_analysis_job_id,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at,omitempty"`
}

type AnalysisJob struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id,omitempty"`
	RepositoryID string     `json:"repository_id,omitempty"`
	Status       string     `json:"status"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

type SafeRepositoryFile struct {
	Path    string `json:"path"`
	Size    int    `json:"size"`
	Content string `json:"content"`
}

type SafeRepositorySnapshot struct {
	RepositoryID string               `json:"repository_id"`
	Branch       string               `json:"branch"`
	Files        []SafeRepositoryFile `json:"files"`
}

type AppError struct {
	Code       string
	Message    string
	HTTPStatus int
	Cause      error
}

func (e *AppError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Cause
}
