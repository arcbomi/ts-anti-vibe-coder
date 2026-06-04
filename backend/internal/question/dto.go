package question

type SaveGeneratedQuestionsRequest struct {
	AnalysisJobID string                   `json:"analysis_job_id"`
	Questions     []GeneratedQuestionInput `json:"questions"`
}

type GeneratedQuestionInput struct {
	Question       string            `json:"question"`
	Options        map[string]string `json:"options"`
	CorrectOption  string            `json:"correct_option"`
	Explanation    string            `json:"explanation"`
	Difficulty     string            `json:"difficulty"`
	SourceFilePath string            `json:"source_file_path"`
}

type SaveGeneratedQuestionsResponse struct {
	SavedCount int `json:"saved_count"`
}

type QuestionsResponse struct {
	ID             string              `json:"id,omitempty"`
	AnalysisJobID  string              `json:"analysis_job_id,omitempty"`
	ExamID         string              `json:"exam_id,omitempty"`
	QuestionsCount int                 `json:"questions_count,omitempty"`
	Questions      []PublicQuestionDTO `json:"questions"`
}

type PublicQuestionDTO struct {
	ID             string            `json:"id"`
	Question       string            `json:"question"`
	Options        map[string]string `json:"options"`
	Difficulty     string            `json:"difficulty,omitempty"`
	SourceFilePath string            `json:"source_file_path,omitempty"`
}

type AnswerKeyResponse struct {
	Answers []AnswerKeyDTO `json:"answers"`
}

type AnswerKeyDTO struct {
	QuestionID    string `json:"question_id"`
	CorrectOption string `json:"correct_option"`
	Explanation   string `json:"explanation"`
}
