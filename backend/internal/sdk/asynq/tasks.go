package asynqsdk

import (
	"context"

	"github.com/hibiken/asynq"
)

const (
	TaskTomorrowSyncProjects = "tomorrow.sync_projects"
	TaskRepoDownload         = "repo.download"
	TaskQuestionsGenerate    = "questions.generate"
	TaskRepoCleanup          = "repo.cleanup"
)

type TomorrowSyncProjectsPayload struct {
	UserID           string `json:"user_id"`
	TomorrowUsername string `json:"tomorrow_username"`
	EventID          string `json:"event_id"`
}

type RepoDownloadPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
	AttemptID   string `json:"attempt_id"`
}

type QuestionsGeneratePayload struct {
	UserID        string `json:"user_id"`
	ProjectSlug   string `json:"project_slug"`
	AttemptID     string `json:"attempt_id"`
	RepoLocalPath string `json:"repo_local_path"`
	CommitHash    string `json:"commit_hash"`
}

type RepoCleanupPayload struct {
	UserID        string `json:"user_id"`
	ProjectSlug   string `json:"project_slug"`
	AttemptID     string `json:"attempt_id"`
	RepoLocalPath string `json:"repo_local_path"`
}

type JobClient interface {
	Enqueue(ctx context.Context, taskName string, payload any, opts ...Option) error
}

type JobHandler interface {
	Register(mux *asynq.ServeMux)
}

func NewTomorrowSyncProjectsTask(payload TomorrowSyncProjectsPayload) (*asynq.Task, error) {
	return NewTask(TaskTomorrowSyncProjects, payload)
}

func NewRepoDownloadTask(payload RepoDownloadPayload) (*asynq.Task, error) {
	return NewTask(TaskRepoDownload, payload)
}

func NewQuestionsGenerateTask(payload QuestionsGeneratePayload) (*asynq.Task, error) {
	return NewTask(TaskQuestionsGenerate, payload)
}

func NewRepoCleanupTask(payload RepoCleanupPayload) (*asynq.Task, error) {
	return NewTask(TaskRepoCleanup, payload)
}
