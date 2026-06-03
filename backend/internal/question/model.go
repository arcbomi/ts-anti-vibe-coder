package question

import "time"

const (
	OptionA = "A"
	OptionB = "B"
	OptionC = "C"
	OptionD = "D"

	DifficultyEasy   = "easy"
	DifficultyMedium = "medium"
	DifficultyHard   = "hard"
)

var optionKeys = []string{OptionA, OptionB, OptionC, OptionD}

type Question struct {
	ID             string
	AnalysisJobID  string
	Question       string
	OptionA        string
	OptionB        string
	OptionC        string
	OptionD        string
	CorrectOption  string
	Explanation    string
	Difficulty     string
	SourceFilePath string
	CreatedAt      time.Time
}

type ExamQuestionOption struct {
	ID             string
	ExamID         string
	QuestionID     string
	DisplayOption  string
	OriginalOption string
	OptionText     string
}

func (q Question) Options() map[string]string {
	return map[string]string{
		OptionA: q.OptionA,
		OptionB: q.OptionB,
		OptionC: q.OptionC,
		OptionD: q.OptionD,
	}
}
