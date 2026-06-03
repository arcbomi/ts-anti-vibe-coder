package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"unicode"

	"backend/pkg/sdk/aiclient"
	"backend/pkg/sdk/gitlabclient"
)

type GitLabClient interface {
	CheckAccess(ctx context.Context, repoURL string) (bool, error)
	GetRepositoryTree(ctx context.Context, repoURL string, branch string) ([]gitlabclient.TreeNode, error)
	GetFileContent(ctx context.Context, repoURL string, filePath string, branch string) ([]byte, error)
}

type AIClient interface {
	GenerateJSON(ctx context.Context, prompt string) (json.RawMessage, error)
}

type JobRunner struct {
	store  AnalysisStore
	gitlab GitLabClient
	ai     AIClient
	filter RepositoryFilter
	log    *slog.Logger
}

func NewJobRunner(store AnalysisStore, gl *gitlabclient.Client, ai *aiclient.Client, log *slog.Logger) *JobRunner {
	return &JobRunner{store: store, gitlab: gl, ai: ai, filter: NewRepositoryFilter(MaxRepositoryFileSize), log: log}
}

func (r *JobRunner) Run(ctx context.Context, msg AnalysisJobMessage) error {
	r.logJob(msg, StatusPending).Info("analysis job started")
	if err := r.checkBotAccess(ctx, msg); err != nil {
		return err
	}
	files, err := r.readRepository(ctx, msg)
	if err != nil {
		return err
	}
	index, err := r.buildCodeIndex(ctx, msg, files)
	if err != nil {
		return err
	}
	analysis, err := r.analyzeCode(ctx, msg, index)
	if err != nil {
		return err
	}
	questions, err := r.generateQuestions(ctx, msg, analysis)
	if err != nil {
		return err
	}
	if err := r.saveQuestions(ctx, msg, questions); err != nil {
		return err
	}
	if err := r.store.CompleteAnalysisJob(ctx, msg.JobID); err != nil {
		return err
	}
	r.logJob(msg, StatusCompleted).Info("analysis job completed")
	return nil
}

func (r *JobRunner) checkBotAccess(ctx context.Context, msg AnalysisJobMessage) error {
	if err := r.updateStatus(ctx, msg, StatusCheckingBotAccess); err != nil {
		return err
	}
	ok, err := r.gitlab.CheckAccess(ctx, msg.GitLabRepoURL)
	if err != nil {
		return ClassifyExternalError(ErrCodeGitLabTemporary, err)
	}
	if !ok {
		perr := NewPermanentError(ErrCodeBotAccessDenied, "GitLab bot does not have access to the repository", nil)
		_ = r.store.FailAnalysisJob(ctx, msg.JobID, perr.Code, perr.Message)
		return perr
	}
	r.logJob(msg, StatusCheckingBotAccess).Info("bot access checked")
	return nil
}

func (r *JobRunner) readRepository(ctx context.Context, msg AnalysisJobMessage) ([]RepositoryFile, error) {
	if err := r.updateStatus(ctx, msg, StatusReadingRepository); err != nil {
		return nil, err
	}
	tree, err := r.gitlab.GetRepositoryTree(ctx, msg.GitLabRepoURL, msg.Branch)
	if err != nil {
		return nil, ClassifyExternalError(ErrCodeGitLabTemporary, err)
	}
	files := make([]RepositoryFile, 0, len(tree))
	for _, node := range tree {
		if node.Type != "blob" || !r.filter.ShouldRead(node.Path, 0) {
			continue
		}
		content, err := r.gitlab.GetFileContent(ctx, msg.GitLabRepoURL, node.Path, msg.Branch)
		if err != nil {
			return nil, ClassifyExternalError(ErrCodeGitLabTemporary, err)
		}
		if !r.filter.AcceptContent(node.Path, content) {
			continue
		}
		files = append(files, RepositoryFile{Path: node.Path, Size: len(content), Content: string(content)})
	}
	if len(files) == 0 {
		return nil, NewPermanentError(ErrCodeRepositoryNotFound, "repository did not contain readable source files", nil)
	}
	r.logJob(msg, StatusReadingRepository).Info("repository files loaded", "file_count", len(files))
	return files, nil
}

type CodeIndex struct {
	UserID         string        `json:"user_id"`
	RepositoryID   string        `json:"repository_id"`
	GitLabRepoURL  string        `json:"gitlab_repository_url"`
	Branch         string        `json:"branch_name"`
	RepositoryTree []string      `json:"repository_file_tree"`
	SelectedFiles  []FileSummary `json:"selected_source_files"`
}
type FileSummary struct {
	Path    string `json:"path"`
	Size    int    `json:"size"`
	Summary string `json:"summary"`
	Excerpt string `json:"excerpt"`
}

func (r *JobRunner) buildCodeIndex(ctx context.Context, msg AnalysisJobMessage, files []RepositoryFile) (CodeIndex, error) {
	if err := r.updateStatus(ctx, msg, StatusIndexingCode); err != nil {
		return CodeIndex{}, err
	}
	index := CodeIndex{
		UserID:         msg.UserID,
		RepositoryID:   msg.RepositoryID,
		GitLabRepoURL:  msg.GitLabRepoURL,
		Branch:         msg.Branch,
		RepositoryTree: make([]string, 0, len(files)),
		SelectedFiles:  make([]FileSummary, 0, len(files)),
	}
	for _, f := range files {
		excerpt := f.Content
		if len(excerpt) > 4000 {
			excerpt = excerpt[:4000]
		}
		index.RepositoryTree = append(index.RepositoryTree, f.Path)
		index.SelectedFiles = append(index.SelectedFiles, FileSummary{Path: f.Path, Size: f.Size, Summary: summarizeFile(f), Excerpt: excerpt})
	}
	r.logJob(msg, StatusIndexingCode).Info("code index built", "file_count", len(index.SelectedFiles))
	return index, nil
}

func (r *JobRunner) analyzeCode(ctx context.Context, msg AnalysisJobMessage, index CodeIndex) (json.RawMessage, error) {
	if err := r.updateStatus(ctx, msg, StatusAnalyzingCode); err != nil {
		return nil, err
	}
	payload, _ := json.Marshal(index)
	prompt := buildRepositoryAnalysisPrompt(string(payload))
	analysis, err := r.ai.GenerateJSON(ctx, prompt)
	if err != nil {
		return nil, ClassifyExternalError(ErrCodeAITimeout, err)
	}
	r.logJob(msg, StatusAnalyzingCode).Info("repository analyzed")
	return analysis, nil
}

func buildRepositoryAnalysisPrompt(payload string) string {
	return `# Agent 7: AI Repository Analysis Agent

## Context

This agent is for the exam platform's AI analysis service.

It does not analyze the backend code of this platform itself.

It analyzes the GitLab repository submitted by the user.

The user will enter a GitLab repository URL, add the platform GitLab userbot as a collaborator, and click "I already added the bot."

After the backend confirms that the bot has access, this agent receives the user's repository code and analyzes it for exam question generation.

The purpose is to understand the user's project well enough to generate questions that test whether the user truly understands their own repository.

## Task

Analyze the user's GitLab repository and understand how the submitted project works.

This analysis will be used by the exam service to generate 20 English-only A/B/C/D questions.

## Responsibilities

- Analyze the GitLab repository submitted by the user.
- Do not analyze this exam platform's own backend repository.
- Detect the submitted project's language.
- Detect the submitted project's framework.
- Find the submitted project's entry points.
- Find important folders and modules.
- Find routes, handlers, services, stores, hooks, components, or CLI commands depending on the project type.
- Understand the real program behavior.
- Understand how data moves through the user's project.
- Understand how the project handles errors.
- Create a structured summary for the question generator.

## Input

The JSON payload below contains:

- User ID
- Repository ID
- GitLab repository URL
- Branch name
- Repository file tree
- Selected source files from the user's repository

## Output

Return only a JSON object in this shape:

{
  "repository_summary": "Short summary of what the user's project does.",
  "project_type": "backend | frontend | fullstack | cli | library | unknown",
  "languages": ["Go", "TypeScript"],
  "frameworks": ["net/http", "React"],
  "entry_points": [
    {
      "file_path": "cmd/server/main.go",
      "description": "Starts the HTTP server."
    }
  ],
  "important_modules": [
    {
      "file_path": "internal/user/handler.go",
      "responsibility": "Handles user-related HTTP requests."
    }
  ],
  "code_flows": [
    {
      "name": "Create user flow",
      "steps": [
        "HTTP request reaches route",
        "Handler parses request body",
        "Service validates data",
        "Repository writes to database",
        "Handler returns JSON response"
      ],
      "source_files": [
        "internal/server/router.go",
        "internal/user/handler.go",
        "internal/user/service.go"
      ]
    }
  ],
  "question_topics": [
    "How routes are registered",
    "How handlers call services",
    "How request data is parsed",
    "How frontend state moves from hook to component"
  ]
}

## Focus Areas

Focus on the actual functionality of the user's project.

Example analysis topics:

- How the submitted program starts.
- How the HTTP server is created.
- How mux, chi, gin, fiber, net/http, express, or another router is used.
- How routes are registered.
- How handlers receive requests.
- How handlers call service functions.
- How request bodies are parsed.
- How responses are returned.
- How errors are handled.
- How database access is separated from business logic.
- How frontend components, hooks, stores, and API clients work together.
- How a user action in the frontend reaches backend logic.
- How CLI commands are registered if the project is a CLI tool.
- How library functions are exposed if the project is a library.

## Important Rule

This agent analyzes the repository submitted by the user for exam generation.

It must not assume the repository is this platform's own backend code.

It must work for different kinds of user projects:

- Go backend
- React frontend
- Fullstack app
- CLI tool
- Library
- Small school project
- Open-source project

## Bad Behavior

Do not do this:

- Do not analyze the exam platform backend itself.
- Do not generate questions yet.
- Do not focus only on README.
- Do not ask shallow project metadata questions.
- Do not assume every repository is a Go backend.
- Do not assume every project uses mux or net/http.

## Good Behavior

Do this:

- Read the user's repository structure.
- Detect what kind of project it is.
- Understand how the user's code works.
- Extract functional behavior.
- Prepare analysis for the question generator.
- Keep source file paths for every important claim.

Repository payload:
` + payload
}

func (r *JobRunner) generateQuestions(ctx context.Context, msg AnalysisJobMessage, analysis json.RawMessage) ([]GeneratedQuestion, error) {
	if err := r.updateStatus(ctx, msg, StatusGeneratingQuestions); err != nil {
		return nil, err
	}
	prompt := `Generate exactly 20 English-only multiple-choice questions for an offline codebase understanding exam from this repository analysis. Return JSON object {"questions":[...]} only. Each question must have question, option_a, option_b, option_c, option_d, correct_option (A/B/C/D), explanation, difficulty, source_file_path. There must be exactly one correct option.` + "\nAnalysis:\n" + string(analysis)
	raw, err := r.ai.GenerateJSON(ctx, prompt)
	if err != nil {
		return nil, ClassifyExternalError(ErrCodeAITimeout, err)
	}
	questions, err := parseAndValidateQuestions(raw)
	if err != nil {
		return nil, NewPermanentError(ErrCodeAIOutputInvalid, err.Error(), err)
	}
	r.logJob(msg, StatusGeneratingQuestions).Info("questions generated", "question_count", len(questions))
	return questions, nil
}

func (r *JobRunner) saveQuestions(ctx context.Context, msg AnalysisJobMessage, questions []GeneratedQuestion) error {
	if err := r.updateStatus(ctx, msg, StatusSavingQuestions); err != nil {
		return err
	}
	if err := r.store.SaveGeneratedQuestions(ctx, msg.JobID, questions); err != nil {
		return err
	}
	r.logJob(msg, StatusSavingQuestions).Info("questions saved", "question_count", len(questions))
	return nil
}

func (r *JobRunner) updateStatus(ctx context.Context, msg AnalysisJobMessage, status string) error {
	if err := r.store.UpdateAnalysisJobStatus(ctx, msg.JobID, status); err != nil {
		return err
	}
	r.logJob(msg, status).Info("analysis job status updated")
	return nil
}

func (r *JobRunner) logJob(msg AnalysisJobMessage, status string) *slog.Logger {
	log := r.log
	if log == nil {
		log = slog.Default()
	}
	return log.With("job_id", msg.JobID, "user_id", msg.UserID, "repository_id", msg.RepositoryID, "status", status, "attempt", msg.Attempt)
}

func summarizeFile(f RepositoryFile) string {
	lines := strings.Count(f.Content, "\n") + 1
	return fmt.Sprintf("%s has %d bytes and approximately %d lines", f.Path, f.Size, lines)
}

func parseAndValidateQuestions(raw json.RawMessage) ([]GeneratedQuestion, error) {
	var envelope struct {
		Questions []GeneratedQuestion `json:"questions"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, err
	}
	if len(envelope.Questions) != 20 {
		return nil, fmt.Errorf("AI output must include exactly 20 questions, got %d", len(envelope.Questions))
	}
	for i, q := range envelope.Questions {
		if strings.TrimSpace(q.Question) == "" || strings.TrimSpace(q.OptionA) == "" || strings.TrimSpace(q.OptionB) == "" || strings.TrimSpace(q.OptionC) == "" || strings.TrimSpace(q.OptionD) == "" || strings.TrimSpace(q.Explanation) == "" || strings.TrimSpace(q.SourceFilePath) == "" {
			return nil, fmt.Errorf("question %d is missing required fields", i+1)
		}
		q.CorrectOption = strings.ToUpper(strings.TrimSpace(q.CorrectOption))
		if q.CorrectOption != "A" && q.CorrectOption != "B" && q.CorrectOption != "C" && q.CorrectOption != "D" {
			return nil, fmt.Errorf("question %d correct_option must be A, B, C, or D", i+1)
		}
		if containsNonEnglishText(q.Question + q.OptionA + q.OptionB + q.OptionC + q.OptionD + q.Explanation) {
			return nil, fmt.Errorf("question %d contains non-English text", i+1)
		}
		envelope.Questions[i].CorrectOption = q.CorrectOption
	}
	return envelope.Questions, nil
}

func containsNonEnglishText(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII && (unicode.IsLetter(r) || unicode.Is(unicode.Han, r) || unicode.Is(unicode.Hiragana, r) || unicode.Is(unicode.Katakana, r) || unicode.Is(unicode.Hangul, r)) {
			return true
		}
	}
	return false
}
