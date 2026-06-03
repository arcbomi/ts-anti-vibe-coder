package analysis

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"
)

type AIClient interface {
	GenerateJSON(ctx context.Context, prompt string) (json.RawMessage, error)
}

type Service struct {
	ai AIClient
}

func NewService(ai AIClient) *Service {
	return &Service{ai: ai}
}

func (s *Service) AnalyzeRepository(ctx context.Context, input RepositoryInput) (json.RawMessage, error) {
	if s == nil || s.ai == nil {
		return nil, fmt.Errorf("ai client is required")
	}
	index := BuildCodeIndex(input)
	payload, err := json.Marshal(index)
	if err != nil {
		return nil, err
	}
	return s.ai.GenerateJSON(ctx, BuildRepositoryAnalysisPrompt(string(payload)))
}

func (s *Service) GenerateQuestionJSON(ctx context.Context, analysis json.RawMessage) (json.RawMessage, error) {
	if s == nil || s.ai == nil {
		return nil, fmt.Errorf("ai client is required")
	}
	return s.ai.GenerateJSON(ctx, BuildQuestionGenerationPrompt(analysis))
}

func (s *Service) GenerateQuestions(ctx context.Context, analysis json.RawMessage) ([]GeneratedQuestion, error) {
	raw, err := s.GenerateQuestionJSON(ctx, analysis)
	if err != nil {
		return nil, err
	}
	return ParseAndValidateQuestions(raw)
}

func (s *Service) GenerateExamQuestions(ctx context.Context, input RepositoryInput) (GenerationResult, error) {
	analysis, err := s.AnalyzeRepository(ctx, input)
	if err != nil {
		return GenerationResult{}, err
	}
	questions, err := s.GenerateQuestions(ctx, analysis)
	if err != nil {
		return GenerationResult{}, err
	}
	return GenerationResult{Analysis: analysis, Questions: questions}, nil
}

func BuildCodeIndex(input RepositoryInput) CodeIndex {
	branch := strings.TrimSpace(input.Branch)
	if branch == "" {
		branch = "main"
	}
	index := CodeIndex{
		UserID:         input.UserID,
		RepositoryID:   input.RepositoryID,
		GitLabRepoURL:  input.GitLabRepoURL,
		Branch:         branch,
		RepositoryTree: make([]string, 0, len(input.RepositoryTree)+len(input.Files)),
		SelectedFiles:  make([]FileSummary, 0, len(input.Files)),
	}
	seen := make(map[string]struct{}, len(input.RepositoryTree)+len(input.Files))
	for _, path := range input.RepositoryTree {
		appendTreePath(&index, seen, path)
	}
	for _, f := range input.Files {
		appendTreePath(&index, seen, f.Path)
		excerpt := f.Content
		if len(excerpt) > 4000 {
			excerpt = excerpt[:4000]
		}
		index.SelectedFiles = append(index.SelectedFiles, FileSummary{Path: f.Path, Size: f.Size, Summary: summarizeFile(f), Excerpt: excerpt})
	}
	return index
}

func appendTreePath(index *CodeIndex, seen map[string]struct{}, path string) {
	path = strings.TrimSpace(path)
	if path == "" {
		return
	}
	if _, ok := seen[path]; ok {
		return
	}
	seen[path] = struct{}{}
	index.RepositoryTree = append(index.RepositoryTree, path)
}

func summarizeFile(f RepositoryFile) string {
	lines := strings.Count(f.Content, "\n") + 1
	return fmt.Sprintf("%s has %d bytes and approximately %d lines", f.Path, f.Size, lines)
}

func ParseAndValidateQuestions(raw json.RawMessage) ([]GeneratedQuestion, error) {
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
