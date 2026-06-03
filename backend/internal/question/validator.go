package question

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/google/uuid"
)

const finalExamQuestionCount = 20

func validateSaveRequest(req SaveGeneratedQuestionsRequest) error {
	if _, err := uuid.Parse(strings.TrimSpace(req.AnalysisJobID)); err != nil {
		return fmt.Errorf("analysis_job_id must be a valid uuid")
	}
	if len(req.Questions) != finalExamQuestionCount {
		return fmt.Errorf("exactly %d questions are required", finalExamQuestionCount)
	}
	for i, q := range req.Questions {
		if err := validateGeneratedQuestion(q); err != nil {
			return fmt.Errorf("question %d: %w", i+1, err)
		}
	}
	return nil
}

func validateGeneratedQuestion(q GeneratedQuestionInput) error {
	if strings.TrimSpace(q.Question) == "" {
		return fmt.Errorf("question text is required")
	}
	if !isMostlyEnglish(q.Question) {
		return fmt.Errorf("question text must be English-only")
	}
	for _, key := range optionKeys {
		text, ok := q.Options[key]
		if !ok {
			return fmt.Errorf("option %s is required", key)
		}
		if strings.TrimSpace(text) == "" {
			return fmt.Errorf("option %s text is required", key)
		}
		if !isMostlyEnglish(text) {
			return fmt.Errorf("option %s must be English-only", key)
		}
	}
	if !isValidOption(q.CorrectOption) {
		return fmt.Errorf("correct_option must be A, B, C, or D")
	}
	if strings.TrimSpace(q.Explanation) == "" {
		return fmt.Errorf("explanation is required")
	}
	if !isMostlyEnglish(q.Explanation) {
		return fmt.Errorf("explanation must be English-only")
	}
	if !isValidDifficulty(q.Difficulty) {
		return fmt.Errorf("difficulty must be easy, medium, or hard")
	}
	if strings.TrimSpace(q.SourceFilePath) == "" {
		return fmt.Errorf("source_file_path is required")
	}
	return nil
}

func isValidOption(value string) bool {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case OptionA, OptionB, OptionC, OptionD:
		return true
	default:
		return false
	}
}

func normalizeOption(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func isValidDifficulty(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case DifficultyEasy, DifficultyMedium, DifficultyHard:
		return true
	default:
		return false
	}
}

func normalizeDifficulty(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isMostlyEnglish(value string) bool {
	letters := 0
	nonLatinLetters := 0
	for _, r := range value {
		if !unicode.IsLetter(r) {
			continue
		}
		letters++
		if r > unicode.MaxASCII && !unicode.In(r, unicode.Latin) {
			nonLatinLetters++
		}
	}
	if letters == 0 {
		return true
	}
	return float64(nonLatinLetters)/float64(letters) <= 0.30
}
