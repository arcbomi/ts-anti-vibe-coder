package exam

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"backend/pkg/sdk/queue"

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
	PrepareSucceededProject(ctx context.Context, req PrepareSucceededProjectRequest) (PrepareSucceededProjectResponse, error)
	ListSucceededProjects(ctx context.Context, userID string) (SucceededProjectsResponse, error)
	StartSucceededProjectPreparation(ctx context.Context, userID string, projectSlug string) (StartSucceededProjectPreparationResponse, error)
}

type AnalysisJobPublisher interface {
	PublishAnalysisJob(ctx context.Context, msg queue.AnalysisJobMessage) error
}

type ExamService struct {
	store        Store
	passingScore int
	examOpenDOW  time.Weekday
	repoJobs     RepoDownloadJobPublisher
	projects     SucceededProjectSource
	analysisJobs AnalysisJobPublisher
}

func NewService(store Store, passingScore int, examOpenDOW string) *ExamService {
	return NewServiceWithRepoJobs(store, passingScore, examOpenDOW, nil)
}

func NewServiceWithRepoJobs(store Store, passingScore int, examOpenDOW string, repoJobs RepoDownloadJobPublisher) *ExamService {
	return NewServiceWithDependencies(store, passingScore, examOpenDOW, repoJobs, nil)
}

func NewServiceWithDependencies(store Store, passingScore int, examOpenDOW string, repoJobs RepoDownloadJobPublisher, projects SucceededProjectSource) *ExamService {
	return NewServiceWithProjectPreparation(store, passingScore, examOpenDOW, repoJobs, projects, nil)
}

func NewServiceWithProjectPreparation(store Store, passingScore int, examOpenDOW string, repoJobs RepoDownloadJobPublisher, projects SucceededProjectSource, analysisJobs AnalysisJobPublisher) *ExamService {
	if passingScore <= 0 || passingScore > QuestionCount {
		passingScore = 14
	}
	weekday, ok := parseWeekday(examOpenDOW)
	if !ok {
		weekday = time.Friday
	}
	return &ExamService{
		store:        store,
		passingScore: passingScore,
		examOpenDOW:  weekday,
		repoJobs:     repoJobs,
		projects:     projects,
		analysisJobs: analysisJobs,
	}
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
	score, passed := Grade(correctCount, exam.PassingScore)
	submittedAt := time.Now().UTC()
	if err := s.store.SaveSubmission(ctx, exam.ID, answers, score, passed, submittedAt); err != nil {
		return ResultResponse{}, databaseError("Unable to store exam submission.", err)
	}
	status := StatusFailed
	if passed {
		status = StatusPassed
	}
	return ResultResponse{
		ID:             exam.ID,
		ExamID:         exam.ID,
		AttemptID:      exam.ID,
		ProjectSlug:    projectSlugFromPath(exam.ProjectSlug),
		Submitted:      true,
		Total:          len(questions),
		TotalQuestions: len(questions),
		CorrectCount:   correctCount,
		Score:          score,
		Passed:         passed,
		PassingScore:   exam.PassingScore,
		Status:         status,
	}, nil
}

func (s *ExamService) GetResult(ctx context.Context, userID string, examID string) (ResultResponse, error) {
	exam, err := s.getExam(ctx, userID, examID)
	if err != nil {
		return ResultResponse{}, err
	}
	if exam.Score == nil || exam.Passed == nil || exam.SubmittedAt == nil {
		return ResultResponse{}, appError(ErrCodeBadRequest, "Exam has not been submitted yet.", http.StatusBadRequest, nil)
	}
	resultAnswers, err := s.store.GetResultAnswers(ctx, exam.ID)
	if err != nil {
		return ResultResponse{}, databaseError("Unable to load exam result.", err)
	}
	correctCount := 0
	for _, answer := range resultAnswers {
		if answer.IsCorrect {
			correctCount++
		}
	}
	return ResultResponse{
		ID:             exam.ID,
		ExamID:         exam.ID,
		AttemptID:      exam.ID,
		ProjectSlug:    projectSlugFromPath(exam.ProjectSlug),
		Total:          QuestionCount,
		TotalQuestions: QuestionCount,
		CorrectCount:   correctCount,
		Score:          *exam.Score,
		Passed:         *exam.Passed,
		PassingScore:   exam.PassingScore,
		Status:         normalizeAttemptStatus(exam),
		Answers:        resultAnswers,
	}, nil
}

func (s *ExamService) PrepareSucceededProject(ctx context.Context, req PrepareSucceededProjectRequest) (PrepareSucceededProjectResponse, error) {
	if err := validatePreparationRequest(req); err != nil {
		return PrepareSucceededProjectResponse{}, err
	}
	if s.repoJobs == nil {
		return PrepareSucceededProjectResponse{}, appError(ErrCodeDatabase, "Preparation queue is not configured.", http.StatusInternalServerError, nil)
	}
	job, err := s.store.CreatePreparationJob(ctx, PreparationJob{
		ID:          uuid.NewString(),
		UserID:      req.UserID,
		ProjectSlug: sanitizeProjectSlug(req.ProjectSlug),
		RepoURL:     strings.TrimSpace(req.RepoURL),
		AttemptID:   req.AttemptID,
		Status:      PreparationJobPending,
		CreatedAt:   time.Now().UTC(),
	})
	if err != nil {
		return PrepareSucceededProjectResponse{}, databaseError("Unable to create preparation job.", err)
	}
	msg := RepoDownloadJobMessage{
		JobID:       job.ID,
		UserID:      job.UserID,
		ProjectSlug: job.ProjectSlug,
		RepoURL:     job.RepoURL,
		AttemptID:   job.AttemptID,
		Attempt:     1,
	}
	if err := s.repoJobs.PublishRepoDownloadJob(ctx, msg); err != nil {
		_ = s.store.FailPreparationJob(ctx, job.ID, "Unable to enqueue repo download job.", time.Now().UTC())
		return PrepareSucceededProjectResponse{}, appError(ErrCodeDatabase, "Unable to enqueue repo download job.", http.StatusBadGateway, err)
	}
	return PrepareSucceededProjectResponse{
		JobID:       job.ID,
		AttemptID:   job.AttemptID,
		Status:      job.Status,
		ProjectSlug: job.ProjectSlug,
	}, nil
}

func (s *ExamService) ListSucceededProjects(ctx context.Context, userID string) (SucceededProjectsResponse, error) {
	if err := validateUUID(userID, "user_id"); err != nil {
		return SucceededProjectsResponse{}, badRequest(err)
	}
	projects, err := s.loadSucceededProjects(ctx, userID)
	if err != nil {
		return SucceededProjectsResponse{}, err
	}
	return SucceededProjectsResponse{Projects: projects}, nil
}

func (s *ExamService) StartSucceededProjectPreparation(ctx context.Context, userID string, projectSlug string) (StartSucceededProjectPreparationResponse, error) {
	if err := validateUUID(userID, "user_id"); err != nil {
		return StartSucceededProjectPreparationResponse{}, badRequest(err)
	}

	projects, err := s.loadSucceededProjects(ctx, userID)
	if err != nil {
		return StartSucceededProjectPreparationResponse{}, err
	}

	slug := sanitizeProjectSlug(projectSlug)
	var selected *SucceededProject
	for i := range projects {
		if projects[i].ProjectSlug == slug {
			selected = &projects[i]
			break
		}
	}
	if selected == nil {
		return StartSucceededProjectPreparationResponse{}, appError(ErrCodeExamNotFound, "Succeeded project not found.", http.StatusNotFound, nil)
	}
	switch selected.PreparationStatus {
	case SucceededProjectStatePreparing, SucceededProjectStateReady, SucceededProjectStatePassed:
		return StartSucceededProjectPreparationResponse{}, appError(ErrCodeAlreadySubmitted, "Project preparation has already started.", http.StatusConflict, nil)
	}
	if s.repoJobs == nil {
		return StartSucceededProjectPreparationResponse{}, appError(ErrCodeDatabase, "Project preparation queue is not configured.", http.StatusServiceUnavailable, nil)
	}
	attemptID := uuid.NewString()
	resp, err := s.PrepareSucceededProject(ctx, PrepareSucceededProjectRequest{
		UserID:      userID,
		ProjectSlug: selected.ProjectSlug,
		RepoURL:     selected.RepoURL,
		AttemptID:   attemptID,
	})
	if err != nil {
		return StartSucceededProjectPreparationResponse{}, err
	}
	return StartSucceededProjectPreparationResponse{
		ProjectSlug:       resp.ProjectSlug,
		PreparationStatus: SucceededProjectStatePreparing,
		AttemptID:         resp.AttemptID,
	}, nil
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

func (s *ExamService) loadSucceededProjects(ctx context.Context, userID string) ([]SucceededProject, error) {
	if s.projects == nil {
		return nil, appError(ErrCodeDatabase, "Succeeded project sync is not configured.", http.StatusServiceUnavailable, nil)
	}

	connection, err := s.store.GetTomorrowConnection(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, appError(ErrCodeExamNotFound, "User not found.", http.StatusNotFound, err)
		}
		return nil, databaseError("Unable to load Tomorrow sync settings.", err)
	}

	discovered, err := s.projects.ListSucceededProjects(ctx, connection)
	if err != nil {
		return nil, appError(ErrCodeDatabase, "Unable to sync succeeded projects from Tomorrow.", http.StatusBadGateway, err)
	}

	prepJobs, err := s.store.ListPreparationJobs(ctx, userID)
	if err != nil {
		return nil, databaseError("Unable to load preparation jobs.", err)
	}
	repositories, err := s.store.ListSucceededProjectRepositories(ctx, userID)
	if err != nil {
		return nil, databaseError("Unable to load succeeded project repositories.", err)
	}
	exams, err := s.store.ListUserExams(ctx, userID)
	if err != nil {
		return nil, databaseError("Unable to load exam attempts.", err)
	}
	examBySlug := map[string]Exam{}
	for _, exam := range exams {
		slug := projectSlugFromPath(exam.ProjectSlug)
		if slug == "" {
			continue
		}
		if _, exists := examBySlug[slug]; !exists {
			examBySlug[slug] = exam
		}
	}
	repositoryBySlug := map[string]SucceededProjectRepositoryRecord{}
	for _, repository := range repositories {
		slug := projectSlugFromPath(repository.ProjectPath)
		if slug == "" {
			continue
		}
		if _, exists := repositoryBySlug[slug]; !exists {
			repositoryBySlug[slug] = repository
		}
	}

	items := make([]SucceededProject, 0, len(discovered))
	for _, project := range discovered {
		if !project.IsSucceeded {
			continue
		}
		item := SucceededProject{
			ProjectSlug:   sanitizeProjectSlug(project.Slug),
			ProjectName:   strings.TrimSpace(project.Name),
			ProjectStatus: strings.TrimSpace(project.Status),
			RepoURL:       strings.TrimSpace(project.RepoURL),
			AuditText:     strings.TrimSpace(project.AuditText),
		}
		if ensuredExam, created, err := s.ensureReadyExam(ctx, userID, repositoryBySlug[item.ProjectSlug], examBySlug[item.ProjectSlug]); err != nil {
			return nil, err
		} else if created {
			examBySlug[item.ProjectSlug] = ensuredExam
		}
		applyLocalProjectState(&item, prepJobs, examBySlug[item.ProjectSlug], repositoryBySlug[item.ProjectSlug])
		items = append(items, item)
	}

	sort.SliceStable(items, func(i, j int) bool {
		return items[i].ProjectName < items[j].ProjectName
	})
	return items, nil
}

func (s *ExamService) ensureReadyExam(ctx context.Context, userID string, repository SucceededProjectRepositoryRecord, exam Exam) (Exam, bool, error) {
	if exam.ID != "" || repository.RepositoryID == "" || repository.LatestAnalysisJobID == "" || repository.LatestAnalysisStatus != "completed" {
		return exam, false, nil
	}
	resp, err := s.CreateExam(ctx, userID, CreateExamRequest{
		RepositoryID:  repository.RepositoryID,
		AnalysisJobID: repository.LatestAnalysisJobID,
	})
	if err != nil {
		var appErr *AppError
		if errors.As(err, &appErr) && (appErr.Code == ErrCodeNotEnoughQuestions || appErr.Code == ErrCodeExamNotFound) {
			return exam, false, nil
		}
		return Exam{}, false, err
	}
	return Exam{
		ID:            resp.ExamID,
		UserID:        userID,
		RepositoryID:  repository.RepositoryID,
		ProjectSlug:   repository.ProjectPath,
		AnalysisJobID: repository.LatestAnalysisJobID,
		Status:        StatusReadyToPass,
		CreatedAt:     time.Now().UTC(),
	}, true, nil
}

func applyLocalProjectState(project *SucceededProject, prepJobs []PreparationJob, exam Exam, repository SucceededProjectRepositoryRecord) {
	if project == nil {
		return
	}
	slug := sanitizeProjectSlug(project.ProjectSlug)

	if exam.ID != "" && projectSlugFromPath(exam.ProjectSlug) == slug {
		if exam.Passed != nil {
			if *exam.Passed {
				project.PreparationStatus = SucceededProjectStatePassed
				project.ExamID = exam.ID
			} else {
				project.PreparationStatus = SucceededProjectStateFailed
				project.ExamID = exam.ID
			}
		} else {
			project.PreparationStatus = SucceededProjectStateReady
			project.ExamID = exam.ID
		}
		return
	}

	switch repository.LatestAnalysisStatus {
	case "failed":
		project.PreparationStatus = SucceededProjectStateGenerationFailed
		project.PreparationErrorMessage = strings.TrimSpace(repository.LatestAnalysisErrorMessage)
		return
	case "completed", "pending", "checking_bot_access", "reading_repository", "indexing_code", "analyzing_code", "generating_questions", "saving_questions":
		project.PreparationStatus = SucceededProjectStatePreparing
		return
	}

	for _, job := range prepJobs {
		if sanitizeProjectSlug(job.ProjectSlug) != slug {
			continue
		}
		switch job.Status {
		case PreparationJobFailed:
			project.PreparationStatus = SucceededProjectStateGenerationFailed
			project.PreparationErrorMessage = strings.TrimSpace(job.ErrorMessage)
		case PreparationJobPending, PreparationJobDownloading, PreparationJobCompleted:
			project.PreparationStatus = SucceededProjectStatePreparing
		default:
			project.PreparationStatus = SucceededProjectStatePreparing
		}
		return
	}

	project.PreparationStatus = SucceededProjectStateNotPrepared
}

func toExamResponse(e Exam) ExamResponse {
	return ExamResponse{
		ID:            e.ID,
		ExamID:        e.ID,
		AttemptID:     e.ID,
		ProjectSlug:   projectSlugFromPath(e.ProjectSlug),
		UserID:        e.UserID,
		RepositoryID:  e.RepositoryID,
		AnalysisJobID: e.AnalysisJobID,
		ScheduledAt:   e.ScheduledAt,
		Status:        normalizeAttemptStatus(e),
		Score:         e.Score,
		Passed:        e.Passed,
		SubmittedAt:   e.SubmittedAt,
	}
}

func toPublicQuestion(q Question) PublicQuestion {
	return PublicQuestion{
		ID:             q.ID,
		QuestionID:     q.ID,
		Index:          q.OrderIndex,
		Question:       q.Question,
		Options:        map[string]string{OptionA: q.OptionA, OptionB: q.OptionB, OptionC: q.OptionC, OptionD: q.OptionD},
		Difficulty:     q.Difficulty,
		SourceFilePath: q.SourceFilePath,
	}
}

func normalizeAttemptStatus(e Exam) string {
	if e.Passed != nil {
		if *e.Passed {
			return StatusPassed
		}
		return StatusFailed
	}
	switch e.Status {
	case StatusPassed, StatusFailed:
		return e.Status
	default:
		return StatusReadyToPass
	}
}

func projectSlugFromPath(projectPath string) string {
	projectPath = strings.TrimSpace(projectPath)
	if projectPath == "" {
		return ""
	}
	parts := strings.Split(projectPath, "/")
	return strings.TrimSpace(parts[len(parts)-1])
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func appError(code string, message string, status int, cause error) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: status, Cause: cause}
}
