package worker

import (
	"context"
	"encoding/json"
	"log/slog"

	"backend/internal/analysis"
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
	input, err := r.buildRepositoryInput(ctx, msg, files)
	if err != nil {
		return err
	}
	analysisResult, err := r.analyzeCode(ctx, msg, input)
	if err != nil {
		return err
	}
	questions, err := r.generateQuestions(ctx, msg, analysisResult)
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

func (r *JobRunner) buildRepositoryInput(ctx context.Context, msg AnalysisJobMessage, files []RepositoryFile) (analysis.RepositoryInput, error) {
	if err := r.updateStatus(ctx, msg, StatusIndexingCode); err != nil {
		return analysis.RepositoryInput{}, err
	}
	input := analysis.RepositoryInput{
		UserID:         msg.UserID,
		RepositoryID:   msg.RepositoryID,
		GitLabRepoURL:  msg.GitLabRepoURL,
		Branch:         msg.Branch,
		RepositoryTree: make([]string, 0, len(files)),
		Files:          make([]analysis.RepositoryFile, 0, len(files)),
	}
	for _, f := range files {
		input.RepositoryTree = append(input.RepositoryTree, f.Path)
		input.Files = append(input.Files, analysis.RepositoryFile{Path: f.Path, Size: f.Size, Content: f.Content})
	}
	r.logJob(msg, StatusIndexingCode).Info("repository input built", "file_count", len(input.Files))
	return input, nil
}

func (r *JobRunner) analyzeCode(ctx context.Context, msg AnalysisJobMessage, input analysis.RepositoryInput) (json.RawMessage, error) {
	if err := r.updateStatus(ctx, msg, StatusAnalyzingCode); err != nil {
		return nil, err
	}
	analysisResult, err := analysis.NewService(r.ai).AnalyzeRepository(ctx, input)
	if err != nil {
		return nil, ClassifyExternalError(ErrCodeAITimeout, err)
	}
	r.logJob(msg, StatusAnalyzingCode).Info("repository analyzed")
	return analysisResult, nil
}

func (r *JobRunner) generateQuestions(ctx context.Context, msg AnalysisJobMessage, analysisResult json.RawMessage) ([]GeneratedQuestion, error) {
	if err := r.updateStatus(ctx, msg, StatusGeneratingQuestions); err != nil {
		return nil, err
	}
	raw, err := analysis.NewService(r.ai).GenerateQuestionJSON(ctx, analysisResult)
	if err != nil {
		return nil, ClassifyExternalError(ErrCodeAITimeout, err)
	}
	questions, err := analysis.ParseAndValidateQuestions(raw)
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
