package analysis

import (
	"strings"
	"testing"
)

func TestBuildCodeIndexIncludesSubmittedRepositoryContext(t *testing.T) {
	input := RepositoryInput{
		UserID:         "user-123",
		RepositoryID:   "repo-456",
		GitLabRepoURL:  "https://gitlab.example.com/group/project",
		Branch:         "develop",
		RepositoryTree: []string{"cmd/server/main.go"},
		Files: []RepositoryFile{
			{Path: "cmd/server/main.go", Size: 12, Content: "package main\n"},
			{Path: "internal/user/handler.go", Size: 18, Content: "package user\n"},
		},
	}

	index := BuildCodeIndex(input)

	if index.UserID != input.UserID || index.RepositoryID != input.RepositoryID || index.GitLabRepoURL != input.GitLabRepoURL || index.Branch != input.Branch {
		t.Fatalf("index did not preserve submitted repository metadata: %+v", index)
	}
	if got, want := len(index.RepositoryTree), 2; got != want {
		t.Fatalf("repository tree length = %d, want %d", got, want)
	}
	if index.RepositoryTree[0] != input.Files[0].Path || index.SelectedFiles[1].Path != input.Files[1].Path {
		t.Fatalf("index did not preserve submitted source file paths: %+v", index)
	}
}

func TestBuildRepositoryAnalysisPromptDescribesAgent7Scope(t *testing.T) {
	prompt := BuildRepositoryAnalysisPrompt(`{"selected_source_files":[]}`)

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
