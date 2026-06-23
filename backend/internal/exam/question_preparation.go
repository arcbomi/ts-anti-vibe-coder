package exam

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"backend/internal/analysis"
	"backend/internal/worker"
)

const defaultPreparationBranch = "main"

type QuestionPreparer interface {
	Prepare(ctx context.Context, req QuestionPreparationRequest) error
}

type QuestionPreparationRequest struct {
	AnalysisJobID string
	UserID        string
	RepositoryID  string
	RepoURL       string
	Branch        string
	LocalPath     string
}

type LocalQuestionPreparer struct {
	store   Store
	service *analysis.Service
	filter  worker.RepositoryFilter
	log     *slog.Logger
}

func NewLocalQuestionPreparer(store Store, service *analysis.Service, log *slog.Logger) *LocalQuestionPreparer {
	if log == nil {
		log = slog.Default()
	}
	return &LocalQuestionPreparer{
		store:   store,
		service: service,
		filter:  worker.NewRepositoryFilter(worker.MaxRepositoryFileSize),
		log:     log,
	}
}

func (p *LocalQuestionPreparer) Prepare(ctx context.Context, req QuestionPreparationRequest) error {
	if p == nil || p.store == nil {
		return fmt.Errorf("question preparation store is required")
	}
	if p.service == nil {
		return fmt.Errorf("question preparation service is required")
	}
	if strings.TrimSpace(req.AnalysisJobID) == "" || strings.TrimSpace(req.LocalPath) == "" {
		return fmt.Errorf("analysis_job_id and local_path are required")
	}

	if err := p.store.UpdateRepositoryAnalysisJobStatus(ctx, req.AnalysisJobID, "reading_repository"); err != nil {
		return err
	}
	input, err := p.readRepositoryInput(req)
	if err != nil {
		return err
	}

	if err := p.store.UpdateRepositoryAnalysisJobStatus(ctx, req.AnalysisJobID, "indexing_code"); err != nil {
		return err
	}
	if err := p.store.UpdateRepositoryAnalysisJobStatus(ctx, req.AnalysisJobID, "analyzing_code"); err != nil {
		return err
	}
	analysisResult, err := p.service.AnalyzeRepository(ctx, input)
	if err != nil {
		return err
	}

	if err := p.store.UpdateRepositoryAnalysisJobStatus(ctx, req.AnalysisJobID, "generating_questions"); err != nil {
		return err
	}
	generatedQuestions, err := p.service.GenerateQuestions(ctx, analysisResult)
	if err != nil {
		return err
	}

	if err := p.store.UpdateRepositoryAnalysisJobStatus(ctx, req.AnalysisJobID, "saving_questions"); err != nil {
		return err
	}
	questions := make([]Question, 0, len(generatedQuestions))
	for _, generated := range generatedQuestions {
		questions = append(questions, Question{
			Question:       generated.Question,
			OptionA:        generated.OptionA,
			OptionB:        generated.OptionB,
			OptionC:        generated.OptionC,
			OptionD:        generated.OptionD,
			CorrectOption:  generated.CorrectOption,
			Explanation:    generated.Explanation,
			Difficulty:     strings.ToLower(strings.TrimSpace(generated.Difficulty)),
			SourceFilePath: generated.SourceFilePath,
			CreatedAt:      time.Now().UTC(),
		})
	}
	if err := p.store.SaveGeneratedQuestions(ctx, req.AnalysisJobID, questions); err != nil {
		return err
	}
	return p.store.CompleteRepositoryAnalysisJob(ctx, req.AnalysisJobID)
}

func (p *LocalQuestionPreparer) readRepositoryInput(req QuestionPreparationRequest) (analysis.RepositoryInput, error) {
	root := strings.TrimSpace(req.LocalPath)
	info, err := os.Stat(root)
	if err != nil {
		return analysis.RepositoryInput{}, fmt.Errorf("read downloaded repository: %w", err)
	}
	if !info.IsDir() {
		return analysis.RepositoryInput{}, fmt.Errorf("downloaded repository path must be a directory")
	}

	files := make([]analysis.RepositoryFile, 0, 64)
	tree := make([]string, 0, 128)
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == root {
			return nil
		}

		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)
		if relPath == "." {
			return nil
		}

		if d.IsDir() {
			if shouldSkipPreparationDir(relPath) {
				return filepath.SkipDir
			}
			tree = append(tree, relPath)
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return err
		}
		tree = append(tree, relPath)
		size := int(info.Size())
		if !p.filter.ShouldRead(relPath, size) {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if !p.filter.AcceptContent(relPath, content) {
			return nil
		}
		files = append(files, analysis.RepositoryFile{
			Path:    relPath,
			Size:    len(content),
			Content: string(content),
		})
		return nil
	})
	if err != nil {
		return analysis.RepositoryInput{}, fmt.Errorf("walk downloaded repository: %w", err)
	}
	if len(files) == 0 {
		return analysis.RepositoryInput{}, fmt.Errorf("downloaded repository did not contain readable source files")
	}

	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	sort.Strings(tree)

	branch := strings.TrimSpace(req.Branch)
	if branch == "" {
		branch = defaultPreparationBranch
	}
	return analysis.RepositoryInput{
		UserID:         strings.TrimSpace(req.UserID),
		RepositoryID:   strings.TrimSpace(req.RepositoryID),
		GiteaRepoURL:   strings.TrimSpace(req.RepoURL),
		Branch:         branch,
		RepositoryTree: tree,
		Files:          files,
	}, nil
}

func shouldSkipPreparationDir(path string) bool {
	path = strings.TrimPrefix(filepath.ToSlash(strings.TrimSpace(path)), "/")
	if path == "" {
		return false
	}
	for _, part := range strings.Split(path, "/") {
		switch part {
		case ".git", "node_modules", "vendor", "dist", "build", "coverage", ".cache":
			return true
		}
	}
	return false
}
