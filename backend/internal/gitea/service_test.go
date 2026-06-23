package gitea

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"backend/internal/tomorrow"
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

func TestSyncTomorrowProjectsPersistsOnlySucceededProjects(t *testing.T) {
	const userID = "00000000-0000-0000-0000-000000000001"

	store := &fakeStore{
		connection: TomorrowConnection{
			Username:    "dmukhat",
			RemoteToken: "tomorrow-jwt",
			ProfilePath: tomorrow.DefaultProfilePath,
		},
	}
	svc := &ReaderService{
		store:            store,
		validator:        NewValidator("https://01.tomorrow-school.ai/git"),
		tomorrowBaseURL:  "https://01.tomorrow-school.ai",
		tomorrowProfiles: fakeTomorrowProfileClient{html: `<html><body><article><h3>go-reloaded</h3><p>Project succeeded</p><p>5 peer audits required</p></article><article><h3>graphql</h3><p>Missing audit</p></article></body></html>`},
		tomorrowUsers:    store,
		log:              slog.Default(),
	}

	repositories, err := svc.SyncTomorrowProjects(context.Background(), userID)
	if err != nil {
		t.Fatalf("SyncTomorrowProjects returned error: %v", err)
	}
	if len(store.createdRepos) != 1 {
		t.Fatalf("created repos = %d, want 1", len(store.createdRepos))
	}
	if store.createdRepos[0].GiteaRepoURL != "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded" {
		t.Fatalf("saved repo url = %q", store.createdRepos[0].GiteaRepoURL)
	}
	if store.createdRepos[0].TomorrowAuditText != "5 peer audits required" {
		t.Fatalf("saved audit text = %q", store.createdRepos[0].TomorrowAuditText)
	}
	if len(repositories) != 1 || repositories[0].GiteaProjectPath != "dmukhat/go-reloaded" {
		t.Fatalf("repositories = %+v", repositories)
	}
}

type fakeStore struct {
	repo             *Repository
	createdRepos     []Repository
	connection       TomorrowConnection
	jobID            string
	failedJobID      string
	failedJobUserID  string
	failedJobMessage string
}

func (f *fakeStore) EnsureSchema(context.Context) error { return nil }
func (f *fakeStore) CreateRepository(_ context.Context, repo *Repository) error {
	if repo != nil {
		f.createdRepos = append(f.createdRepos, *repo)
		f.repo = repo
	}
	return nil
}
func (f *fakeStore) ListRepositories(context.Context, string) ([]Repository, error) {
	if len(f.createdRepos) == 0 {
		return nil, nil
	}
	repositories := make([]Repository, 0, len(f.createdRepos))
	repositories = append(repositories, f.createdRepos...)
	return repositories, nil
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
func (f *fakeStore) GetTomorrowConnection(context.Context, string) (TomorrowConnection, error) {
	return f.connection, nil
}

type fakePublisher struct {
	err error
}

func (f fakePublisher) PublishAnalysisJob(context.Context, queue.AnalysisJobMessage) error {
	return f.err
}

type fakeTomorrowProfileClient struct {
	html string
	err  error
}

func (f fakeTomorrowProfileClient) FetchProfilePage(context.Context, tomorrow.Session, string) (string, error) {
	return f.html, f.err
}
