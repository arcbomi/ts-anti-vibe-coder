package exam

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	ErrCodeBadRequest            = "BAD_REQUEST"
	ErrCodeExamNotFound          = "EXAM_NOT_FOUND"
	ErrCodeAlreadySubmitted      = "EXAM_ALREADY_SUBMITTED"
	ErrCodeNotEnoughQuestions    = "NOT_ENOUGH_QUESTIONS"
	ErrCodeInvalidQuestionID     = "INVALID_QUESTION_ID"
	ErrCodeInvalidSelectedOption = "INVALID_SELECTED_OPTION"
	ErrCodeQuestionNotInExam     = "QUESTION_NOT_IN_EXAM"
	ErrCodeDatabase              = "DATABASE_ERROR"
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
	CreateExam(ctx context.Context, userID string, req CreateExamRequest) (CreateExamResponse, error)
	GetExam(ctx context.Context, userID string, examID string) (ExamResponse, error)
	GetQuestions(ctx context.Context, userID string, examID string) (QuestionsResponse, error)
	SubmitExam(ctx context.Context, userID string, examID string, req SubmitExamRequest) (ResultResponse, error)
	GetResult(ctx context.Context, userID string, examID string) (ResultResponse, error)
}

type ExamService struct {
	store        Store
	passingScore int
	examOpenDOW  time.Weekday
}

func NewService(store Store, passingScore int, examOpenDOW string) *ExamService {
	if passingScore <= 0 || passingScore > 100 {
		passingScore = 70
	}
	weekday, ok := parseWeekday(examOpenDOW)
	if !ok {
		weekday = time.Friday
	}
	return &ExamService{store: store, passingScore: passingScore, examOpenDOW: weekday}
}

func (s *ExamService) CreateExam(ctx context.Context, userID string, req CreateExamRequest) (CreateExamResponse, error) {
	req.UserID = userID
	if err := validateUUID(req.UserID, "user_id"); err != nil {
		return CreateExamResponse{}, badRequest(err)
	}
	if err := validateUUID(req.AnalysisJobID, "analysis_job_id"); err != nil {
		return CreateExamResponse{}, badRequest(err)
	}

	if strings.TrimSpace(req.RepositoryID) == "" {
		repositoryID, err := s.store.GetAnalysisJobRepositoryID(ctx, req.UserID, req.AnalysisJobID)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				return CreateExamResponse{}, appError(ErrCodeExamNotFound, "Analysis job not found.", http.StatusNotFound, err)
			}
			return CreateExamResponse{}, databaseError("Unable to validate exam source analysis.", err)
		}
		req.RepositoryID = repositoryID
	} else if err := validateUUID(req.RepositoryID, "repository_id"); err != nil {
		return CreateExamResponse{}, badRequest(err)
	}

	if req.ScheduledAt.IsZero() {
		req.ScheduledAt = nextScheduledExamTime(time.Now().UTC(), s.examOpenDOW)
	}
	if req.ScheduledAt.UTC().Weekday() != s.examOpenDOW {
		return CreateExamResponse{}, badRequest(fmt.Errorf("scheduled_at must be on %s", s.examOpenDOW.String()))
	}
	if err := s.store.VerifyAnalysisJobOwnership(ctx, req.UserID, req.RepositoryID, req.AnalysisJobID); err != nil {
		if errors.Is(err, ErrNotFound) {
			return CreateExamResponse{}, appError(ErrCodeExamNotFound, "Analysis job not found.", http.StatusNotFound, err)
		}
		return CreateExamResponse{}, databaseError("Unable to validate exam source analysis.", err)
	}

	questions, err := s.store.GetGeneratedQuestions(ctx, req.AnalysisJobID, QuestionCount)
	if err != nil {
		return CreateExamResponse{}, databaseError("Unable to load generated questions.", err)
	}
	if len(questions) < QuestionCount {
		return CreateExamResponse{}, appError(ErrCodeNotEnoughQuestions, "This analysis job does not have 20 generated questions.", http.StatusConflict, nil)
	}

	exam := Exam{UserID: req.UserID, RepositoryID: req.RepositoryID, AnalysisJobID: req.AnalysisJobID, ScheduledAt: req.ScheduledAt.UTC(), Status: StatusScheduled, PassingScore: s.passingScore}
	created, err := s.store.CreateExamWithQuestions(ctx, exam, questions)
	if err != nil {
		return CreateExamResponse{}, databaseError("Unable to create exam.", err)
	}
	return CreateExamResponse{ID: created.ID, ExamID: created.ID, AnalysisJobID: created.AnalysisJobID, Status: created.Status, QuestionCount: len(questions)}, nil
}

func (s *ExamService) GetExam(ctx context.Context, userID string, examID string) (ExamResponse, error) {
	exam, err := s.getExam(ctx, userID, examID)
	if err != nil {
		return ExamResponse{}, err
	}
	questions, err := s.store.GetExamQuestions(ctx, exam.ID)
	if err != nil {
		return ExamResponse{}, databaseError("Unable to load exam questions.", err)
	}
	public := make([]PublicQuestion, 0, len(questions))
	for _, q := range questions {
		public = append(public, toPublicQuestion(q))
	}
	resp := toExamResponse(exam)
	resp.Questions = public
	return resp, nil
}

func (s *ExamService) GetQuestions(ctx context.Context, userID string, examID string) (QuestionsResponse, error) {
	exam, err := s.getExam(ctx, userID, examID)
	if err != nil {
		return QuestionsResponse{}, err
	}
	questions, err := s.store.GetExamQuestions(ctx, exam.ID)
	if err != nil {
		return QuestionsResponse{}, databaseError("Unable to load exam questions.", err)
	}
	if len(questions) != QuestionCount {
		return QuestionsResponse{}, appError(ErrCodeNotEnoughQuestions, "Exam does not have exactly 20 assigned questions.", http.StatusConflict, nil)
	}
	public := make([]PublicQuestion, 0, len(questions))
	for _, q := range questions {
		public = append(public, toPublicQuestion(q))
	}
	return QuestionsResponse{ExamID: exam.ID, Questions: public}, nil
}

func (s *ExamService) SubmitExam(ctx context.Context, userID string, examID string, req SubmitExamRequest) (ResultResponse, error) {
	exam, err := s.getExam(ctx, userID, examID)
	if err != nil {
		return ResultResponse{}, err
	}
	if exam.Status == StatusSubmitted || exam.Status == StatusGraded || exam.SubmittedAt != nil {
		return ResultResponse{}, appError(ErrCodeAlreadySubmitted, "This exam has already been submitted.", http.StatusConflict, nil)
	}

	questions, err := s.store.GetExamQuestions(ctx, exam.ID)
	if err != nil {
		return ResultResponse{}, databaseError("Unable to load exam questions.", err)
	}
	if len(questions) != QuestionCount {
		return ResultResponse{}, appError(ErrCodeNotEnoughQuestions, "Exam does not have exactly 20 assigned questions.", http.StatusConflict, nil)
	}
	answers, correctCount, err := buildGradedAnswers(exam.ID, questions, req.Answers)
	if err != nil {
		return ResultResponse{}, err
	}
	score, passed := Grade(correctCount, len(questions), exam.PassingScore)
	submittedAt := time.Now().UTC()
	if err := s.store.SaveSubmission(ctx, exam.ID, answers, score, passed, submittedAt); err != nil {
		return ResultResponse{}, databaseError("Unable to store exam submission.", err)
	}
	return ResultResponse{ExamID: exam.ID, Submitted: true, TotalQuestions: len(questions), CorrectCount: correctCount, Score: score, Passed: passed, PassingScore: exam.PassingScore}, nil
}

func (s *ExamService) GetResult(ctx context.Context, userID string, examID string) (ResultResponse, error) {
	exam, err := s.getExam(ctx, userID, examID)
	if err != nil {
		return ResultResponse{}, err
	}
	if exam.Score == nil || exam.Passed == nil || exam.Status != StatusGraded {
		return ResultResponse{}, appError(ErrCodeBadRequest, "Exam has not been submitted yet.", http.StatusBadRequest, nil)
	}
	correctCount, err := s.store.CountCorrectAnswers(ctx, exam.ID)
	if err != nil {
		return ResultResponse{}, databaseError("Unable to load exam result.", err)
	}
	return ResultResponse{ExamID: exam.ID, TotalQuestions: QuestionCount, CorrectCount: correctCount, Score: *exam.Score, Passed: *exam.Passed, PassingScore: exam.PassingScore, Status: exam.Status}, nil
}

func (s *ExamService) getExam(ctx context.Context, userID string, examID string) (Exam, error) {
	if err := validateUUID(userID, "user_id"); err != nil {
		return Exam{}, badRequest(err)
	}
	if err := validateUUID(examID, "exam_id"); err != nil {
		return Exam{}, badRequest(err)
	}
	exam, err := s.store.GetExam(ctx, userID, examID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Exam{}, appError(ErrCodeExamNotFound, "Exam not found.", http.StatusNotFound, err)
		}
		return Exam{}, databaseError("Unable to load exam.", err)
	}
	return exam, nil
}

func buildGradedAnswers(examID string, questions []Question, submitted []SubmittedAnswer) ([]Answer, int, error) {
	if len(submitted) != len(questions) {
		return nil, 0, appError(ErrCodeInvalidQuestionID, "Exactly 20 answers are required.", http.StatusBadRequest, nil)
	}
	questionByID := make(map[string]Question, len(questions))
	for _, q := range questions {
		questionByID[q.ID] = q
	}
	seen := map[string]bool{}
	answers := make([]Answer, 0, len(submitted))
	correctCount := 0
	for _, submittedAnswer := range submitted {
		if err := validateUUID(submittedAnswer.QuestionID, "question_id"); err != nil {
			return nil, 0, appError(ErrCodeInvalidQuestionID, err.Error(), http.StatusBadRequest, err)
		}
		selected := strings.ToUpper(strings.TrimSpace(submittedAnswer.SelectedOption))
		if !IsValidOption(selected) {
			return nil, 0, appError(ErrCodeInvalidSelectedOption, "selected_option must be A, B, C, or D.", http.StatusBadRequest, nil)
		}
		if seen[submittedAnswer.QuestionID] {
			return nil, 0, appError(ErrCodeInvalidQuestionID, "Duplicate question_id in submission.", http.StatusBadRequest, nil)
		}
		seen[submittedAnswer.QuestionID] = true
		q, ok := questionByID[submittedAnswer.QuestionID]
		if !ok {
			return nil, 0, appError(ErrCodeQuestionNotInExam, "Submitted question_id does not belong to this exam.", http.StatusBadRequest, nil)
		}
		isCorrect := selected == q.CorrectOption
		if isCorrect {
			correctCount++
		}
		answers = append(answers, Answer{ExamID: examID, QuestionID: q.ID, SelectedOption: selected, IsCorrect: isCorrect})
	}
	return answers, correctCount, nil
}

func toExamResponse(e Exam) ExamResponse {
	return ExamResponse{ID: e.ID, ExamID: e.ID, UserID: e.UserID, RepositoryID: e.RepositoryID, AnalysisJobID: e.AnalysisJobID, ScheduledAt: e.ScheduledAt, Status: e.Status, Score: e.Score, Passed: e.Passed, SubmittedAt: e.SubmittedAt}
}

func toPublicQuestion(q Question) PublicQuestion {
	return PublicQuestion{QuestionID: q.ID, Question: q.Question, Options: map[string]string{OptionA: q.OptionA, OptionB: q.OptionB, OptionC: q.OptionC, OptionD: q.OptionD}, Difficulty: q.Difficulty, SourceFilePath: q.SourceFilePath}
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return fmt.Errorf("%s must be a valid UUID", field)
	}
	return nil
}

func nextScheduledExamTime(now time.Time, weekday time.Weekday) time.Time {
	base := now.UTC()
	daysAhead := (int(weekday) - int(base.Weekday()) + 7) % 7
	scheduled := time.Date(base.Year(), base.Month(), base.Day(), 9, 0, 0, 0, time.UTC)
	if daysAhead == 0 && !base.Before(scheduled) {
		daysAhead = 7
	}
	return scheduled.AddDate(0, 0, daysAhead)
}

func parseWeekday(value string) (time.Weekday, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "sunday":
		return time.Sunday, true
	case "monday":
		return time.Monday, true
	case "tuesday":
		return time.Tuesday, true
	case "wednesday":
		return time.Wednesday, true
	case "thursday":
		return time.Thursday, true
	case "friday":
		return time.Friday, true
	case "saturday":
		return time.Saturday, true
	case "":
		return time.Friday, true
	default:
		return time.Friday, false
	}
}

func badRequest(err error) error {
	return appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
}

func databaseError(message string, err error) error {
	return appError(ErrCodeDatabase, message, http.StatusInternalServerError, err)
}

func appError(code string, message string, status int, cause error) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: status, Cause: cause}
}
