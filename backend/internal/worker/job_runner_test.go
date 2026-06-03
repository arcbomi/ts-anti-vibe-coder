package worker

import (
	"context"
	"strings"
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

func TestBuildCodeIndexIncludesSubmittedRepositoryContext(t *testing.T) {
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

	index, err := runner.buildCodeIndex(context.Background(), msg, files)
	if err != nil {
		t.Fatalf("buildCodeIndex returned error: %v", err)
	}

	if index.UserID != msg.UserID || index.RepositoryID != msg.RepositoryID || index.GitLabRepoURL != msg.GitLabRepoURL || index.Branch != msg.Branch {
		t.Fatalf("index did not preserve submitted repository metadata: %+v", index)
	}
	if got, want := len(index.RepositoryTree), len(files); got != want {
		t.Fatalf("repository tree length = %d, want %d", got, want)
	}
	if index.RepositoryTree[0] != files[0].Path || index.SelectedFiles[1].Path != files[1].Path {
		t.Fatalf("index did not preserve submitted source file paths: %+v", index)
	}
}

func TestBuildRepositoryAnalysisPromptDescribesAgent7Scope(t *testing.T) {
	prompt := buildRepositoryAnalysisPrompt(`{"selected_source_files":[]}`)

	required := []string{
		"# Agent 7: AI Repository Analysis Agent",
		"It analyzes the GitLab repository submitted by the user.",
		"Do not analyze this exam platform's own backend repository.",
		"Return only a JSON object in this shape:",
		"\"repository_summary\"",
		"\"project_type\"",
		"\"entry_points\"",
		"\"important_modules\"",
		"\"code_flows\"",
		"\"question_topics\"",
		"Do not generate questions yet.",
		"Do not assume every repository is a Go backend.",
		"Repository payload:",
	}
	for _, want := range required {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q\nPrompt:\n%s", want, prompt)
		}
	}
}
