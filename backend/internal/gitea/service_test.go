package gitea

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"backend/pkg/sdk/queue"
)

func TestStartAnalysisMarksJobFailedWhenQueuePublishFails(t *testing.T) {
	const (
		userID       = "00000000-0000-0000-0000-000000000001"
		repositoryID = "00000000-0000-0000-0000-000000000002"
		jobID        = "00000000-0000-0000-0000-000000000003"
	)

	store := &fakeStore{
		repo: &Repository{
			ID:              repositoryID,
			UserID:          userID,
			GiteaRepoURL:    "https://gitea.com/group/project",
			DefaultBranch:   "main",
			BotAccessStatus: BotAccessGranted,
		},
		jobID: jobID,
	}
	svc := &ReaderService{
		store:     store,
		validator: &Validator{},
		queue:     fakePublisher{err: errors.New("queue unavailable")},
		log:       slog.Default(),
	}

	_, err := svc.StartAnalysis(context.Background(), userID, repositoryID)
	if err == nil {
		t.Fatal("StartAnalysis returned nil error")
	}

	if store.failedJobID != jobID {
		t.Fatalf("failed job id = %q, want %q", store.failedJobID, jobID)
	}
	if store.failedJobUserID != userID {
		t.Fatalf("failed job user id = %q, want %q", store.failedJobUserID, userID)
	}
	if store.failedJobMessage != "Unable to enqueue analysis job." {
		t.Fatalf("failed job message = %q", store.failedJobMessage)
	}
}

type fakeStore struct {
	repo             *Repository
	jobID            string
	failedJobID      string
	failedJobUserID  string
	failedJobMessage string
}

func (f *fakeStore) EnsureSchema(context.Context) error { return nil }
func (f *fakeStore) CreateRepository(context.Context, *Repository) error {
	return nil
}
func (f *fakeStore) ListRepositories(context.Context, string) ([]Repository, error) {
	return nil, nil
}
func (f *fakeStore) GetRepository(context.Context, string, string) (*Repository, error) {
	if f.repo == nil {
		return nil, ErrNotFound
	}
	return f.repo, nil
}
func (f *fakeStore) UpdateBotAccess(context.Context, string, string, string, string) (*Repository, error) {
	return f.repo, nil
}
func (f *fakeStore) CreateAnalysisJob(_ context.Context, job *AnalysisJob) error {
	if f.jobID != "" {
		job.ID = f.jobID
	}
	return nil
}
func (f *fakeStore) FailAnalysisJob(_ context.Context, userID string, analysisJobID string, message string) error {
	f.failedJobUserID = userID
	f.failedJobID = analysisJobID
	f.failedJobMessage = message
	return nil
}
func (f *fakeStore) GetAnalysisJob(context.Context, string, string) (*AnalysisJob, error) {
	return nil, ErrNotFound
}

type fakePublisher struct {
	err error
}

func (f fakePublisher) PublishAnalysisJob(context.Context, queue.AnalysisJobMessage) error {
	return f.err
}
