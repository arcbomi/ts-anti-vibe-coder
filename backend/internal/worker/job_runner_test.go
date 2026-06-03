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

func TestBuildQuestionGenerationPromptDescribesAgent8ScopeAndOutput(t *testing.T) {
	prompt := buildQuestionGenerationPrompt([]byte(`{"repository_summary":"task api"}`))

	required := []string{
		"# Agent 8: Runtime AI Question Generator Agent",
		"Analyze the user's GitLab repository only.",
		"Do not generate questions about:",
		"this platform backend",
		"Generate exactly 20 English-only multiple-choice questions",
		"Use the nested options object with keys A, B, C, and D.",
		"source_file_path must point to a file from the user's repository analysis.",
		"Repository analysis:",
	}
	for _, want := range required {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q\nPrompt:\n%s", want, prompt)
		}
	}
}

func TestParseAndValidateQuestionsAcceptsNestedOptions(t *testing.T) {
	raw := []byte(buildQuestionsJSON("medium"))

	questions, err := parseAndValidateQuestions(raw)
	if err != nil {
		t.Fatalf("parseAndValidateQuestions returned error: %v", err)
	}
	if got, want := len(questions), 20; got != want {
		t.Fatalf("question count = %d, want %d", got, want)
	}
	first := questions[0]
	if first.OptionA != "The handler parses the request and calls the service." || first.OptionB == "" || first.CorrectOption != "A" || first.Difficulty != "medium" {
		t.Fatalf("nested options were not normalized into generated question fields: %+v", first)
	}
}

func TestParseAndValidateQuestionsRejectsInvalidDifficulty(t *testing.T) {
	raw := []byte(buildQuestionsJSON("expert"))

	_, err := parseAndValidateQuestions(raw)
	if err == nil || !strings.Contains(err.Error(), "difficulty must be easy, medium, or hard") {
		t.Fatalf("expected invalid difficulty error, got %v", err)
	}
}

func buildQuestionsJSON(difficulty string) string {
	items := make([]string, 0, 20)
	for i := 0; i < 20; i++ {
		items = append(items, `{
			"question":"In this user's repository, what happens when the create task endpoint is called?",
			"options":{
				"A":"The handler parses the request and calls the service.",
				"B":"The frontend writes directly to the database.",
				"C":"The route is generated from package metadata.",
				"D":"The scheduler deletes the task before validation."
			},
			"correct_option":"A",
			"explanation":"The repository analysis describes a request flow where the handler parses input before delegating creation to the service layer.",
			"difficulty":"`+difficulty+`",
			"source_file_path":"internal/task/handler.go"
		}`)
	}
	return `{"questions":[` + strings.Join(items, ",") + `]}`
}
