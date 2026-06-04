package question

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

const (
	ErrCodeBadRequest = "BAD_REQUEST"
	ErrCodeNotFound   = "NOT_FOUND"
	ErrCodeInternal   = "INTERNAL_SERVER_ERROR"
)

type AppError struct {
	Code       string
	Message    string
	HTTPStatus int
	Cause      error
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

func (e *AppError) Unwrap() error { return e.Cause }

type Service interface {
	SaveGeneratedQuestions(ctx context.Context, req SaveGeneratedQuestionsRequest) (SaveGeneratedQuestionsResponse, error)
	GetQuestionsByAnalysisJob(ctx context.Context, userID string, analysisJobID string) (QuestionsResponse, error)
	GetExamQuestions(ctx context.Context, userID string, examID string) (QuestionsResponse, error)
	GetAnswerKey(ctx context.Context, examID string) (AnswerKeyResponse, error)
}

type QuestionService struct {
	store Store
}

func NewService(store Store) *QuestionService {
	return &QuestionService{store: store}
}

func (s *QuestionService) SaveGeneratedQuestions(ctx context.Context, req SaveGeneratedQuestionsRequest) (SaveGeneratedQuestionsResponse, error) {
	if err := validateSaveRequest(req); err != nil {
		return SaveGeneratedQuestionsResponse{}, appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	questions := make([]Question, 0, len(req.Questions))
	for _, input := range req.Questions {
		questions = append(questions, toQuestion(req.AnalysisJobID, input))
	}
	count, err := s.store.SaveGeneratedQuestions(ctx, req.AnalysisJobID, questions)
	if err != nil {
		return SaveGeneratedQuestionsResponse{}, appError(ErrCodeInternal, "Unable to save generated questions.", http.StatusInternalServerError, err)
	}
	return SaveGeneratedQuestionsResponse{SavedCount: count}, nil
}

func (s *QuestionService) GetQuestionsByAnalysisJob(ctx context.Context, userID string, analysisJobID string) (QuestionsResponse, error) {
	if err := validateUUID(userID, "user id"); err != nil {
		return QuestionsResponse{}, appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	if err := validateUUID(analysisJobID, "analysis job id"); err != nil {
		return QuestionsResponse{}, appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	questions, err := s.store.GetQuestionsByAnalysisJob(ctx, userID, analysisJobID)
	if err != nil {
		return QuestionsResponse{}, mapStoreError(err, "Questions not found.")
	}
	dtos := make([]PublicQuestionDTO, 0, len(questions))
	for _, q := range questions {
		dtos = append(dtos, toPublicQuestion(q, true))
	}
	return QuestionsResponse{ID: analysisJobID, AnalysisJobID: analysisJobID, QuestionsCount: len(dtos), Questions: dtos}, nil
}

func (s *QuestionService) GetExamQuestions(ctx context.Context, userID string, examID string) (QuestionsResponse, error) {
	if err := validateUUID(userID, "user id"); err != nil {
		return QuestionsResponse{}, appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	if err := validateUUID(examID, "exam id"); err != nil {
		return QuestionsResponse{}, appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	questions, err := s.store.GetQuestionsByExam(ctx, userID, examID)
	if err != nil {
		return QuestionsResponse{}, mapStoreError(err, "Exam questions not found.")
	}
	mappingByQuestion, err := s.ensureExamOptionMappings(ctx, examID, questions)
	if err != nil {
		return QuestionsResponse{}, appError(ErrCodeInternal, "Unable to prepare exam questions.", http.StatusInternalServerError, err)
	}

	dtos := make([]PublicQuestionDTO, 0, len(questions))
	for _, q := range shuffledQuestions(questions) {
		options := map[string]string{}
		for _, m := range mappingByQuestion[q.ID] {
			options[m.DisplayOption] = m.OptionText
		}
		dtos = append(dtos, PublicQuestionDTO{ID: q.ID, Question: q.Question, Options: options, Difficulty: q.Difficulty})
	}
	return QuestionsResponse{ID: examID, ExamID: examID, QuestionsCount: len(dtos), Questions: dtos}, nil
}

func (s *QuestionService) GetAnswerKey(ctx context.Context, examID string) (AnswerKeyResponse, error) {
	if err := validateUUID(examID, "exam id"); err != nil {
		return AnswerKeyResponse{}, appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	questions, err := s.store.GetQuestionsByExamForInternal(ctx, examID)
	if err != nil {
		return AnswerKeyResponse{}, mapStoreError(err, "Exam questions not found.")
	}
	mappings, err := s.store.GetExamOptionMappings(ctx, examID)
	if err != nil {
		return AnswerKeyResponse{}, appError(ErrCodeInternal, "Unable to read answer key.", http.StatusInternalServerError, err)
	}
	correctDisplayOption := map[string]string{}
	for _, m := range mappings {
		correctDisplayOption[m.QuestionID+":"+m.OriginalOption] = m.DisplayOption
	}

	answers := make([]AnswerKeyDTO, 0, len(questions))
	for _, q := range questions {
		correct := q.CorrectOption
		if mapped := correctDisplayOption[q.ID+":"+q.CorrectOption]; mapped != "" {
			correct = mapped
		}
		answers = append(answers, AnswerKeyDTO{QuestionID: q.ID, CorrectOption: correct, Explanation: q.Explanation})
	}
	return AnswerKeyResponse{Answers: answers}, nil
}

func (s *QuestionService) ensureExamOptionMappings(ctx context.Context, examID string, questions []Question) (map[string][]ExamQuestionOption, error) {
	existing, err := s.store.GetExamOptionMappings(ctx, examID)
	if err != nil {
		return nil, err
	}
	if hasCompleteMappings(existing, questions) {
		return groupMappings(existing), nil
	}

	mappings := []ExamQuestionOption{}
	for _, q := range questions {
		originalOptions := q.Options()
		shuffledOriginals := shuffledOptionKeys()
		for i, original := range shuffledOriginals {
			display := optionKeys[i]
			mappings = append(mappings, ExamQuestionOption{ExamID: examID, QuestionID: q.ID, DisplayOption: display, OriginalOption: original, OptionText: originalOptions[original]})
		}
	}
	if err := s.store.SaveExamOptionMappings(ctx, examID, mappings); err != nil {
		return nil, err
	}
	return groupMappings(mappings), nil
}

func hasCompleteMappings(mappings []ExamQuestionOption, questions []Question) bool {
	if len(mappings) != len(questions)*len(optionKeys) {
		return false
	}
	counts := map[string]int{}
	for _, m := range mappings {
		counts[m.QuestionID]++
	}
	for _, q := range questions {
		if counts[q.ID] != len(optionKeys) {
			return false
		}
	}
	return true
}

func groupMappings(mappings []ExamQuestionOption) map[string][]ExamQuestionOption {
	grouped := map[string][]ExamQuestionOption{}
	for _, m := range mappings {
		grouped[m.QuestionID] = append(grouped[m.QuestionID], m)
	}
	return grouped
}

func mapStoreError(err error, message string) error {
	if errors.Is(err, ErrNotFound) {
		return appError(ErrCodeNotFound, message, http.StatusNotFound, err)
	}
	return appError(ErrCodeInternal, "Internal server error.", http.StatusInternalServerError, err)
}

func appError(code string, message string, status int, cause error) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: status, Cause: cause}
}
