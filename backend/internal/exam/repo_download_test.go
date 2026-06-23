package exam

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"backend/internal/analysis"
	"backend/pkg/sdk/queue"
	"backend/pkg/sdk/secretbox"
)

func TestSanitizeProjectSlug(t *testing.T) {
	cases := map[string]string{
		"go-reloaded":     "go-reloaded",
		" Go Reloaded ":   "go-reloaded",
		"../../evil repo": "evil-repo",
		"HELLO__world!!!": "hello__world",
		"@@@":             "project",
	}
	for input, want := range cases {
		if got := sanitizeProjectSlug(input); got != want {
			t.Fatalf("sanitizeProjectSlug(%q)=%q want=%q", input, got, want)
		}
	}
}

func TestInjectGitCredentialsRedactsPassword(t *testing.T) {
	cloneURL, redactedURL, err := injectGitCredentials("https://01.tomorrow-school.ai/git/dmukhat/go-reloaded", "student", "super-secret-password")
	if err != nil {
		t.Fatalf("injectGitCredentials returned error: %v", err)
	}
	if !strings.Contains(cloneURL, "super-secret-password") {
		t.Fatalf("clone url should include password for git auth: %s", cloneURL)
	}
	if strings.Contains(redactedURL, "super-secret-password") {
		t.Fatalf("redacted url leaked password: %s", redactedURL)
	}
	if !strings.Contains(redactedURL, "REDACTED") {
		t.Fatalf("redacted url should contain placeholder: %s", redactedURL)
	}
}

func TestGitDownloadServiceCloneFailureDoesNotLeakPassword(t *testing.T) {
	box, err := secretbox.New("test-secret")
	if err != nil {
		t.Fatalf("secretbox.New returned error: %v", err)
	}
	encrypted, err := box.Encrypt("super-secret-password")
	if err != nil {
		t.Fatalf("Encrypt returned error: %v", err)
	}
	svc := NewGitDownloadService(t.TempDir(), fakeTomorrowConnectionStore{
		connection: TomorrowConnection{
			LoginCredential: "student",
			LoginPassword:   encrypted,
		},
	}, box, time.Second, slog.New(slog.NewTextHandler(io.Discard, nil)))
	svc.exec = func(context.Context, string, string, ...string) ([]byte, error) {
		return nil, errors.New("fatal: repository not found")
	}
	_, err = svc.Download(context.Background(), DownloadRepoRequest{
		UserID:      "00000000-0000-0000-0000-000000000001",
		ProjectSlug: "go-reloaded",
		RepoURL:     "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded",
		AttemptID:   "00000000-0000-0000-0000-000000000002",
	})
	if err == nil {
		t.Fatal("expected clone failure")
	}
	if strings.Contains(err.Error(), "super-secret-password") {
		t.Fatalf("error leaked password: %v", err)
	}
	if !strings.Contains(err.Error(), "REDACTED") {
		t.Fatalf("error should use redacted repo url: %v", err)
	}
}

type fakeTomorrowConnectionStore struct {
	connection TomorrowConnection
	err        error
}

func (f fakeTomorrowConnectionStore) GetTomorrowConnection(context.Context, string) (TomorrowConnection, error) {
	if f.err != nil {
		return TomorrowConnection{}, f.err
	}
	return f.connection, nil
}

type fakeDownloadStore struct {
	fakeStore
	markedDownloading []string
	completedJobs     []struct {
		jobID      string
		localPath  string
		commitHash string
	}
	failedJobs []struct {
		jobID   string
		message string
	}
	failedAnalysisJobs    []string
	analysisStatusUpdates []string
	savedQuestions        []Question
}

func (f *fakeDownloadStore) MarkPreparationJobDownloading(_ context.Context, jobID string) error {
	f.markedDownloading = append(f.markedDownloading, jobID)
	return nil
}

func (f *fakeDownloadStore) CompletePreparationJob(_ context.Context, jobID, localPath, commitHash string, _ time.Time) error {
	f.completedJobs = append(f.completedJobs, struct {
		jobID      string
		localPath  string
		commitHash string
	}{jobID: jobID, localPath: localPath, commitHash: commitHash})
	return nil
}

func (f *fakeDownloadStore) FailPreparationJob(_ context.Context, jobID, errorMessage string, _ time.Time) error {
	f.failedJobs = append(f.failedJobs, struct {
		jobID   string
		message string
	}{jobID: jobID, message: errorMessage})
	return nil
}

func (f *fakeDownloadStore) FailRepositoryAnalysisJob(_ context.Context, analysisJobID, _ string) error {
	f.failedAnalysisJobs = append(f.failedAnalysisJobs, analysisJobID)
	return nil
}

func (f *fakeDownloadStore) UpdateRepositoryAnalysisJobStatus(_ context.Context, _ string, status string) error {
	f.analysisStatusUpdates = append(f.analysisStatusUpdates, status)
	return nil
}

func (f *fakeDownloadStore) CompleteRepositoryAnalysisJob(_ context.Context, _ string) error {
	f.analysisStatusUpdates = append(f.analysisStatusUpdates, "completed")
	return nil
}

func (f *fakeDownloadStore) SaveGeneratedQuestions(_ context.Context, _ string, questions []Question) error {
	f.savedQuestions = append([]Question(nil), questions...)
	return nil
}

type fakeDownloader struct {
	repo *DownloadedRepo
	err  error
}

func (f fakeDownloader) Download(context.Context, DownloadRepoRequest) (*DownloadedRepo, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.repo, nil
}

type fakePreparationAIClient struct{}

func (fakePreparationAIClient) GenerateJSON(_ context.Context, prompt string) (json.RawMessage, error) {
	if strings.Contains(prompt, `"selected_source_files"`) {
		return json.RawMessage(`{"repository_summary":"Test repo","project_type":"backend","languages":["Go"],"frameworks":["net/http"],"entry_points":[{"file_path":"cmd/server/main.go","description":"Starts the program."}],"important_modules":[{"file_path":"cmd/server/main.go","responsibility":"Application entry point."}],"code_flows":[{"name":"Program start","steps":["main starts"],"source_files":["cmd/server/main.go"]}],"question_topics":["program start"]}`), nil
	}
	items := make([]string, 0, 20)
	for i := 1; i <= 20; i++ {
		items = append(items, fmt.Sprintf(`{"question":"What happens in flow %02d?","option_a":"Wrong A","option_b":"Correct B","option_c":"Wrong C","option_d":"Wrong D","correct_option":"B","explanation":"The code path shows B.","difficulty":"medium","source_file_path":"cmd/server/main.go"}`, i))
	}
	return json.RawMessage(`{"questions":[` + strings.Join(items, ",") + `]}`), nil
}

func TestRepoDownloadProcessorStartsQuestionWorkflowAfterSuccess(t *testing.T) {
	store := &fakeDownloadStore{
		fakeStore: fakeStore{
			upsertedProject: &SucceededProjectRepositoryRecord{
				RepositoryID:  "00000000-0000-0000-0000-000000000501",
				RepoURL:       "https://example.com/git/student-user/forum",
				ProjectPath:   "student-user/forum",
				DefaultBranch: "main",
			},
		},
	}
	analysis := &fakeAnalysisPublisher{}
	processor := NewRepoDownloadProcessor(
		store,
		fakeDownloader{repo: &DownloadedRepo{
			LocalPath:    "/tmp/repos/forum/source",
			CommitHash:   "abc123",
			DownloadedAt: time.Date(2026, 6, 23, 10, 0, 0, 0, time.UTC),
		}},
		nil,
		analysis,
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)

	err := processor.Process(context.Background(), RepoDownloadJobMessage{
		JobID:       "00000000-0000-0000-0000-000000000701",
		UserID:      "00000000-0000-0000-0000-000000000100",
		ProjectSlug: "forum",
		RepoURL:     "https://example.com/git/student-user/forum",
		AttemptID:   "00000000-0000-0000-0000-000000000702",
		Attempt:     1,
	})
	if err != nil {
		t.Fatalf("Process returned error: %v", err)
	}
	if len(store.markedDownloading) != 1 || store.markedDownloading[0] != "00000000-0000-0000-0000-000000000701" {
		t.Fatalf("expected job to be marked downloading: %+v", store.markedDownloading)
	}
	if len(store.completedJobs) != 1 || store.completedJobs[0].localPath != "/tmp/repos/forum/source" || store.completedJobs[0].commitHash != "abc123" {
		t.Fatalf("expected completed job to store downloaded repo details: %+v", store.completedJobs)
	}
	if len(analysis.messages) != 1 {
		t.Fatalf("expected one analysis job to be published, got %d", len(analysis.messages))
	}
	if analysis.messages[0] != (queue.AnalysisJobMessage{
		JobID:        "00000000-0000-0000-0000-000000000601",
		UserID:       "00000000-0000-0000-0000-000000000100",
		RepositoryID: "00000000-0000-0000-0000-000000000501",
		GiteaRepoURL: "https://example.com/git/student-user/forum",
		Branch:       "main",
		Attempt:      1,
	}) {
		t.Fatalf("unexpected analysis job payload: %+v", analysis.messages[0])
	}
}

func TestRepoDownloadProcessorPreparesQuestionsFromDownloadedRepo(t *testing.T) {
	root := t.TempDir()
	repoPath := filepath.Join(root, "source")
	if err := os.MkdirAll(filepath.Join(repoPath, "cmd", "server"), 0o755); err != nil {
		t.Fatalf("mkdir repo: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repoPath, "cmd", "server", "main.go"), []byte("package main\nfunc main() {}\n"), 0o644); err != nil {
		t.Fatalf("write repo file: %v", err)
	}

	store := &fakeDownloadStore{
		fakeStore: fakeStore{
			upsertedProject: &SucceededProjectRepositoryRecord{
				RepositoryID:  "00000000-0000-0000-0000-000000000501",
				RepoURL:       "https://example.com/git/student-user/forum",
				ProjectPath:   "student-user/forum",
				DefaultBranch: "main",
			},
		},
	}
	preparer := NewLocalQuestionPreparer(store, analysis.NewService(fakePreparationAIClient{}), slog.New(slog.NewTextHandler(io.Discard, nil)))
	processor := NewRepoDownloadProcessorWithPreparer(
		store,
		fakeDownloader{repo: &DownloadedRepo{
			LocalPath:    repoPath,
			CommitHash:   "abc123",
			DownloadedAt: time.Date(2026, 6, 23, 10, 0, 0, 0, time.UTC),
		}},
		nil,
		&fakeAnalysisPublisher{},
		preparer,
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)

	err := processor.Process(context.Background(), RepoDownloadJobMessage{
		JobID:       "00000000-0000-0000-0000-000000000801",
		UserID:      "00000000-0000-0000-0000-000000000100",
		ProjectSlug: "forum",
		RepoURL:     "https://example.com/git/student-user/forum",
		AttemptID:   "00000000-0000-0000-0000-000000000802",
		Attempt:     1,
	})
	if err != nil {
		t.Fatalf("Process returned error: %v", err)
	}
	if len(store.savedQuestions) != 20 {
		t.Fatalf("expected exactly 20 saved questions, got %d", len(store.savedQuestions))
	}
	if len(store.analysisStatusUpdates) == 0 || store.analysisStatusUpdates[len(store.analysisStatusUpdates)-1] != "completed" {
		t.Fatalf("expected analysis job to complete, got %v", store.analysisStatusUpdates)
	}
}

func TestRepoDownloadProcessorFailsPreparationWhenDownloadFails(t *testing.T) {
	store := &fakeDownloadStore{}
	processor := NewRepoDownloadProcessor(
		store,
		fakeDownloader{err: errors.New("fatal: repository not found")},
		nil,
		&fakeAnalysisPublisher{},
		slog.New(slog.NewTextHandler(io.Discard, nil)),
	)

	err := processor.Process(context.Background(), RepoDownloadJobMessage{
		JobID:       "00000000-0000-0000-0000-000000000711",
		UserID:      "00000000-0000-0000-0000-000000000100",
		ProjectSlug: "forum",
		RepoURL:     "https://example.com/git/student-user/forum",
		AttemptID:   "00000000-0000-0000-0000-000000000712",
		Attempt:     1,
	})
	if err == nil {
		t.Fatal("expected download failure")
	}
	if len(store.failedJobs) != 1 || !strings.Contains(store.failedJobs[0].message, "repository not found") {
		t.Fatalf("expected failed preparation job to save error message: %+v", store.failedJobs)
	}
	if len(store.completedJobs) != 0 {
		t.Fatalf("download failure should not complete job: %+v", store.completedJobs)
	}
}
