package exam

import "time"

const (
	QuestionCount = 20

	StatusCreated     = "created"
	StatusScheduled   = "scheduled"
	StatusInProgress  = "in_progress"
	StatusSubmitted   = "submitted"
	StatusGraded      = "graded"
	StatusCancelled   = "cancelled"
	StatusReadyToPass = "ready_to_pass"
	StatusPassed      = "passed"
	StatusFailed      = "failed"

	OptionA = "A"
	OptionB = "B"
	OptionC = "C"
	OptionD = "D"
)

type Exam struct {
	ID            string
	UserID        string
	RepositoryID  string
	ProjectSlug   string
	AnalysisJobID string
	ScheduledAt   time.Time
	Status        string
	Score         *int
	Passed        *bool
	PassingScore  int
	CreatedAt     time.Time
	SubmittedAt   *time.Time
}

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
	OrderIndex     int
}

type Answer struct {
	ID             string
	ExamID         string
	QuestionID     string
	SelectedOption string
	IsCorrect      bool
	CreatedAt      time.Time
}

type CreateExamRequest struct {
	UserID        string    `json:"user_id"`
	RepositoryID  string    `json:"repository_id"`
	AnalysisJobID string    `json:"analysis_job_id"`
	ScheduledAt   time.Time `json:"scheduled_at"`
}

type CreateExamResponse struct {
	ID            string `json:"id"`
	ExamID        string `json:"exam_id"`
	AnalysisJobID string `json:"analysis_job_id,omitempty"`
	Status        string `json:"status"`
	QuestionCount int    `json:"question_count,omitempty"`
}

type ExamResponse struct {
	ID            string           `json:"id,omitempty"`
	ExamID        string           `json:"exam_id,omitempty"`
	AttemptID     string           `json:"attempt_id"`
	ProjectSlug   string           `json:"project_slug"`
	UserID        string           `json:"user_id,omitempty"`
	RepositoryID  string           `json:"repository_id,omitempty"`
	AnalysisJobID string           `json:"analysis_job_id,omitempty"`
	ScheduledAt   time.Time        `json:"scheduled_at"`
	Status        string           `json:"status"`
	Score         *int             `json:"score,omitempty"`
	Passed        *bool            `json:"passed,omitempty"`
	SubmittedAt   *time.Time       `json:"submitted_at,omitempty"`
	Questions     []PublicQuestion `json:"questions,omitempty"`
}

type PublicQuestion struct {
	ID             string            `json:"id"`
	QuestionID     string            `json:"question_id,omitempty"`
	Index          int               `json:"index"`
	Question       string            `json:"question"`
	Options        map[string]string `json:"options"`
	Difficulty     string            `json:"difficulty"`
	SourceFilePath string            `json:"source_file_path"`
}

type QuestionsResponse struct {
	ExamID    string           `json:"exam_id"`
	Questions []PublicQuestion `json:"questions"`
}

type SubmitExamRequest struct {
	Answers []SubmittedAnswer `json:"answers"`
}

type SubmittedAnswer struct {
	QuestionID     string `json:"question_id"`
	SelectedOption string `json:"selected_option"`
}

type ResultResponse struct {
	ID             string         `json:"id,omitempty"`
	ExamID         string         `json:"exam_id,omitempty"`
	AttemptID      string         `json:"attempt_id"`
	ProjectSlug    string         `json:"project_slug"`
	Submitted      bool           `json:"submitted,omitempty"`
	Total          int            `json:"total"`
	TotalQuestions int            `json:"total_questions,omitempty"`
	CorrectCount   int            `json:"correct_count,omitempty"`
	Score          int            `json:"score"`
	Passed         bool           `json:"passed"`
	PassingScore   int            `json:"passing_score,omitempty"`
	Status         string         `json:"status,omitempty"`
	Answers        []ResultAnswer `json:"answers,omitempty"`
}

type ResultAnswer struct {
	QuestionID     string `json:"question_id"`
	SelectedOption string `json:"selected_option"`
	IsCorrect      bool   `json:"is_correct"`
	CorrectOption  string `json:"correct_option"`
	Explanation    string `json:"explanation"`
}

const (
	SucceededProjectStateNotPrepared      = "not_started"
	SucceededProjectStatePreparing        = "preparing"
	SucceededProjectStateReady            = "ready_to_pass"
	SucceededProjectStatePassed           = "passed"
	SucceededProjectStateFailed           = "failed"
	SucceededProjectStateGenerationFailed = "failed_generation"
)

type SucceededProject struct {
	ProjectSlug             string `json:"project_slug"`
	ProjectName             string `json:"project_name"`
	ProjectStatus           string `json:"project_status"`
	RepoURL                 string `json:"repo_url"`
	AuditText               string `json:"audit_text,omitempty"`
	PreparationStatus       string `json:"preparation_status"`
	PreparationErrorMessage string `json:"preparation_error_message,omitempty"`
	ExamID                  string `json:"exam_id,omitempty"`
}

type SucceededProjectsResponse struct {
	Projects []SucceededProject `json:"projects"`
}

type StartSucceededProjectPreparationResponse struct {
	ProjectSlug       string `json:"project_slug"`
	PreparationStatus string `json:"preparation_status"`
	AttemptID         string `json:"attempt_id"`
}
