package kafka

import "fmt"

const (
	TopicProjectDiscovered          = "project.discovered.v1"
	TopicProjectSucceededDetected   = "project.succeeded_detected.v1"
	TopicExamTryPassRequested       = "exam.try_pass_requested.v1"
	TopicRepoDownloadRequested      = "repo.download_requested.v1"
	TopicRepoDownloaded             = "repo.downloaded.v1"
	TopicRepoDownloadFailed         = "repo.download_failed.v1"
	TopicQuestionsGenerationStarted = "questions.generation_started.v1"
	TopicQuestionsReady             = "questions.ready.v1"
	TopicQuestionsGenerationFailed  = "questions.generation_failed.v1"
	TopicExamSubmitted              = "exam.submitted.v1"
	TopicExamPassed                 = "exam.passed.v1"
	TopicExamFailed                 = "exam.failed.v1"
)

var allTopics = []string{
	TopicProjectDiscovered,
	TopicProjectSucceededDetected,
	TopicExamTryPassRequested,
	TopicRepoDownloadRequested,
	TopicRepoDownloaded,
	TopicRepoDownloadFailed,
	TopicQuestionsGenerationStarted,
	TopicQuestionsReady,
	TopicQuestionsGenerationFailed,
	TopicExamSubmitted,
	TopicExamPassed,
	TopicExamFailed,
}

// Topics returns the canonical event topic list used by the system.
func Topics() []string {
	out := make([]string, len(allTopics))
	copy(out, allTopics)
	return out
}

type ProjectDiscoveredPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	ProjectName string `json:"project_name"`
	RepoURL     string `json:"repo_url"`
	Status      string `json:"status"`
	AuditText   string `json:"audit_text"`
}

func (p ProjectDiscoveredPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.ProjectName == "" || p.RepoURL == "" || p.Status == "" || p.AuditText == "" {
		return fmt.Errorf("all project.discovered.v1 payload fields are required")
	}
	return nil
}

type ProjectSucceededDetectedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
}

func (p ProjectSucceededDetectedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.RepoURL == "" {
		return fmt.Errorf("all project.succeeded_detected.v1 payload fields are required")
	}
	return nil
}

type ExamTryPassRequestedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
}

func (p ExamTryPassRequestedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" {
		return fmt.Errorf("all exam.try_pass_requested.v1 payload fields are required")
	}
	return nil
}

type RepoDownloadRequestedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
	AttemptID   string `json:"attempt_id"`
}

func (p RepoDownloadRequestedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.RepoURL == "" || p.AttemptID == "" {
		return fmt.Errorf("all repo.download_requested.v1 payload fields are required")
	}
	return nil
}

type RepoDownloadedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
	AttemptID   string `json:"attempt_id"`
	LocalPath   string `json:"local_path"`
	CommitHash  string `json:"commit_hash"`
}

func (p RepoDownloadedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.RepoURL == "" || p.AttemptID == "" || p.LocalPath == "" || p.CommitHash == "" {
		return fmt.Errorf("all repo.downloaded.v1 payload fields are required")
	}
	return nil
}

type RepoDownloadFailedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
	Error       string `json:"error"`
}

func (p RepoDownloadFailedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" || p.Error == "" {
		return fmt.Errorf("all repo.download_failed.v1 payload fields are required")
	}
	return nil
}

type QuestionsGenerationStartedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
}

func (p QuestionsGenerationStartedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" {
		return fmt.Errorf("all questions.generation_started.v1 payload fields are required")
	}
	return nil
}

type QuestionsReadyPayload struct {
	UserID        string `json:"user_id"`
	ProjectSlug   string `json:"project_slug"`
	AttemptID     string `json:"attempt_id"`
	QuestionCount int    `json:"question_count"`
}

func (p QuestionsReadyPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" {
		return fmt.Errorf("user_id, project_slug, and attempt_id are required")
	}
	if p.QuestionCount <= 0 {
		return fmt.Errorf("question_count must be greater than zero")
	}
	return nil
}

type QuestionsGenerationFailedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
	Error       string `json:"error"`
}

func (p QuestionsGenerationFailedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" || p.Error == "" {
		return fmt.Errorf("all questions.generation_failed.v1 payload fields are required")
	}
	return nil
}

type ExamSubmittedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
	Score       int    `json:"score"`
	Total       int    `json:"total"`
	Passed      bool   `json:"passed"`
}

func (p ExamSubmittedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" {
		return fmt.Errorf("user_id, project_slug, and attempt_id are required")
	}
	if p.Score < 0 || p.Total <= 0 || p.Score > p.Total {
		return fmt.Errorf("score and total are invalid")
	}
	return nil
}

type ExamPassedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
}

func (p ExamPassedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" {
		return fmt.Errorf("all exam.passed.v1 payload fields are required")
	}
	return nil
}

type ExamFailedPayload struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	AttemptID   string `json:"attempt_id"`
	Score       int    `json:"score"`
	Total       int    `json:"total"`
}

func (p ExamFailedPayload) Validate() error {
	if p.UserID == "" || p.ProjectSlug == "" || p.AttemptID == "" {
		return fmt.Errorf("user_id, project_slug, and attempt_id are required")
	}
	if p.Score < 0 || p.Total <= 0 || p.Score > p.Total {
		return fmt.Errorf("score and total are invalid")
	}
	return nil
}
