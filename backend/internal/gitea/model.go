package gitea

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
	ErrCodeGiteaAPIError        = "GITEA_API_ERROR"
	ErrCodeQueuePublishFailed   = "QUEUE_PUBLISH_FAILED"
	ErrCodeTomorrowNotConnected = "TOMORROW_NOT_CONNECTED"
	ErrCodeTomorrowSyncFailed   = "TOMORROW_SYNC_FAILED"
	ErrCodeUnauthorized         = "UNAUTHORIZED"
	ErrCodeInternal             = "INTERNAL_ERROR"
)

var ErrNotFound = errors.New("repository not found")

type Repository struct {
	ID                         string    `json:"id"`
	UserID                     string    `json:"user_id,omitempty"`
	GiteaRepoURL               string    `json:"gitea_repo_url"`
	GiteaProjectPath           string    `json:"gitea_project_path,omitempty"`
	TomorrowAuditText          string    `json:"tomorrow_audit_text,omitempty"`
	DefaultBranch              string    `json:"default_branch,omitempty"`
	BotAccessStatus            string    `json:"bot_access_status"`
	LatestAnalysisJobID        *string   `json:"latest_analysis_job_id,omitempty"`
	LatestAnalysisStatus       *string   `json:"latest_analysis_status,omitempty"`
	LatestAnalysisErrorMessage *string   `json:"latest_analysis_error_message,omitempty"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at,omitempty"`
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
