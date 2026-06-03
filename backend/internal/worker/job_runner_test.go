package worker

import (
	"context"
	"testing"
)

type noopAnalysisStore struct{}

func (noopAnalysisStore) EnsureSchema(context.Context) error                            { return nil }
func (noopAnalysisStore) UpdateAnalysisJobStatus(context.Context, string, string) error { return nil }
func (noopAnalysisStore) FailAnalysisJob(context.Context, string, string, string) error { return nil }
func (noopAnalysisStore) CompleteAnalysisJob(context.Context, string) error             { return nil }
func (noopAnalysisStore) SaveGeneratedQuestions(context.Context, string, []GeneratedQuestion) error {
	return nil
}

func TestBuildRepositoryInputUsesSubmittedRepositoryFiles(t *testing.T) {
	runner := &JobRunner{store: noopAnalysisStore{}}
	msg := AnalysisJobMessage{
		UserID:        "user-123",
		RepositoryID:  "repo-456",
		GitLabRepoURL: "https://gitlab.example.com/group/project",
		Branch:        "develop",
	}
	files := []RepositoryFile{
		{Path: "cmd/server/main.go", Size: 12, Content: "package main\n"},
		{Path: "internal/user/handler.go", Size: 18, Content: "package user\n"},
	}

	input, err := runner.buildRepositoryInput(context.Background(), msg, files)
	if err != nil {
		t.Fatalf("buildRepositoryInput returned error: %v", err)
	}

	if input.UserID != msg.UserID || input.RepositoryID != msg.RepositoryID || input.GitLabRepoURL != msg.GitLabRepoURL || input.Branch != msg.Branch {
		t.Fatalf("input did not preserve submitted repository metadata: %+v", input)
	}
	if got, want := len(input.Files), len(files); got != want {
		t.Fatalf("file count = %d, want %d", got, want)
	}
	if input.RepositoryTree[0] != files[0].Path || input.Files[1].Path != files[1].Path {
		t.Fatalf("input did not preserve submitted source file paths: %+v", input)
	}
}
