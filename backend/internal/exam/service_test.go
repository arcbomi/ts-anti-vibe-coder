package exam

import (
	"context"
	"errors"
	"testing"
	"time"

	"backend/internal/tomorrow"
	"backend/pkg/sdk/queue"
)

type fakeStore struct {
	exam              Exam
	questions         []Question
	repositoryID      string
	connection        TomorrowConnection
	prepJobs          []PreparationJob
	exams             []Exam
	repositories      []SucceededProjectRepositoryRecord
	createdAnalysis   []RepositoryAnalysisJobRecord
	upsertedProject   *SucceededProjectRepositoryRecord
	createAnalysisErr error
}

type fakeSucceededProjectSource struct {
	projects []tomorrow.Project
}

type fakeRepoDownloadPublisher struct {
	messages []RepoDownloadJobMessage
}

type fakeAnalysisPublisher struct {
	messages []queue.AnalysisJobMessage
}

func (f fakeSucceededProjectSource) ListSucceededProjects(context.Context, TomorrowConnection) ([]tomorrow.Project, error) {
	return f.projects, nil
}

func (f *fakeStore) EnsureSchema(context.Context) error { return nil }

func (f *fakeStore) VerifyAnalysisJobOwnership(context.Context, string, string, string) error {
	return nil
}

func (f *fakeStore) GetAnalysisJobRepositoryID(context.Context, string, string) (string, error) {
	return f.repositoryID, nil
}

func (f *fakeStore) GetGeneratedQuestions(context.Context, string, int) ([]Question, error) {
	return f.questions, nil
}

func (f *fakeStore) UpdateRepositoryAnalysisJobStatus(context.Context, string, string) error {
	return nil
}

func (f *fakeStore) CompleteRepositoryAnalysisJob(context.Context, string) error { return nil }

func (f *fakeStore) SaveGeneratedQuestions(context.Context, string, []Question) error { return nil }

func (f *fakeStore) CreateExamWithQuestions(_ context.Context, exam Exam, _ []Question) (Exam, error) {
	if exam.ID == "" {
		exam.ID = "exam-1"
	}
	return exam, nil
}

func (f *fakeStore) GetExam(context.Context, string, string) (Exam, error) {
	return f.exam, nil
}

func (f *fakeStore) GetExamQuestions(context.Context, string) ([]Question, error) {
	return f.questions, nil
}

func (f *fakeStore) SaveSubmission(context.Context, string, []Answer, int, bool, time.Time) error {
	return nil
}

func (f *fakeStore) GetResultAnswers(context.Context, string) ([]ResultAnswer, error) {
	return nil, nil
}

func (f *fakeStore) CreatePreparationJob(_ context.Context, job PreparationJob) (PreparationJob, error) {
	if job.ID == "" {
		job.ID = "prep-1"
	}
	return job, nil
}

func (f *fakeStore) MarkPreparationJobDownloading(context.Context, string) error { return nil }

func (f *fakeStore) CompletePreparationJob(context.Context, string, string, string, time.Time) error {
	return nil
}

func (f *fakeStore) FailPreparationJob(context.Context, string, string, time.Time) error { return nil }

func (f *fakeStore) GetTomorrowConnection(context.Context, string) (TomorrowConnection, error) {
	return f.connection, nil
}

func (f *fakeStore) ListPreparationJobs(context.Context, string) ([]PreparationJob, error) {
	return f.prepJobs, nil
}

func (f *fakeStore) UpsertSucceededProjectRepository(_ context.Context, _ string, repoURL, auditText string) (SucceededProjectRepositoryRecord, error) {
	if f.upsertedProject != nil {
		return *f.upsertedProject, nil
	}
	return SucceededProjectRepositoryRecord{
		RepositoryID:  "00000000-0000-0000-0000-000000000501",
		RepoURL:       repoURL,
		ProjectPath:   "student/" + projectSlugFromPath(repoURL),
		AuditText:     auditText,
		DefaultBranch: "main",
	}, nil
}

func (f *fakeStore) ListSucceededProjectRepositories(context.Context, string) ([]SucceededProjectRepositoryRecord, error) {
	return f.repositories, nil
}

func (f *fakeStore) CreateRepositoryAnalysisJob(_ context.Context, userID, repositoryID string) (RepositoryAnalysisJobRecord, error) {
	if f.createAnalysisErr != nil {
		return RepositoryAnalysisJobRecord{}, f.createAnalysisErr
	}
	record := RepositoryAnalysisJobRecord{
		ID:           "00000000-0000-0000-0000-000000000601",
		UserID:       userID,
		RepositoryID: repositoryID,
		Status:       "pending",
		CreatedAt:    time.Date(2026, 6, 23, 9, 0, 0, 0, time.UTC),
	}
	f.createdAnalysis = append(f.createdAnalysis, record)
	return record, nil
}

func (f *fakeStore) FailRepositoryAnalysisJob(context.Context, string, string) error { return nil }

func (f *fakeStore) ListUserExams(context.Context, string) ([]Exam, error) {
	if len(f.exams) > 0 {
		return f.exams, nil
	}
	if f.exam.ID != "" {
		return []Exam{f.exam}, nil
	}
	return nil, nil
}

func (f *fakeRepoDownloadPublisher) PublishRepoDownloadJob(_ context.Context, msg RepoDownloadJobMessage) error {
	f.messages = append(f.messages, msg)
	return nil
}

func (f *fakeAnalysisPublisher) PublishAnalysisJob(_ context.Context, msg queue.AnalysisJobMessage) error {
	f.messages = append(f.messages, msg)
	return nil
}

func TestNewServiceDefaultsToFridayWhenUnset(t *testing.T) {
	svc := NewService(nil, 14, "")
	if svc.examOpenDOW != time.Friday {
		t.Fatalf("examOpenDOW = %s, want Friday", svc.examOpenDOW)
	}
}

func TestNewServiceFallsBackToFridayForInvalidDay(t *testing.T) {
	svc := NewService(nil, 14, "noday")
	if svc.examOpenDOW != time.Friday {
		t.Fatalf("examOpenDOW = %s, want Friday", svc.examOpenDOW)
	}
}

func TestGetExamIncludesExamSafeQuestions(t *testing.T) {
	store := &fakeStore{
		exam: Exam{
			ID:            "00000000-0000-0000-0000-000000000200",
			UserID:        "00000000-0000-0000-0000-000000000100",
			RepositoryID:  "00000000-0000-0000-0000-000000000300",
			ProjectSlug:   "group/project",
			AnalysisJobID: "00000000-0000-0000-0000-000000000400",
			ScheduledAt:   time.Date(2026, 6, 5, 9, 0, 0, 0, time.UTC),
			Status:        StatusInProgress,
		},
		questions: []Question{{
			ID:             "00000000-0000-0000-0000-000000000010",
			Question:       "What happens in the handler?",
			OptionA:        "It parses input.",
			OptionB:        "It writes CSS.",
			OptionC:        "It bypasses services.",
			OptionD:        "It mutates Gitea.",
			CorrectOption:  OptionA,
			Explanation:    "Handlers parse requests before calling services.",
			Difficulty:     "medium",
			SourceFilePath: "internal/handler/user_handler.go",
		}},
	}
	service := NewService(store, 14, "Friday")

	resp, err := service.GetExam(context.Background(), store.exam.UserID, store.exam.ID)
	if err != nil {
		t.Fatalf("GetExam returned error: %v", err)
	}
	if resp.ID != store.exam.ID || resp.ExamID != store.exam.ID {
		t.Fatalf("expected both exam ids, got %+v", resp)
	}
	if resp.AttemptID != store.exam.ID || resp.ProjectSlug != "project" || resp.Status != StatusReadyToPass {
		t.Fatalf("unexpected exam metadata: %+v", resp)
	}
	if len(resp.Questions) != 1 {
		t.Fatalf("expected one question, got %d", len(resp.Questions))
	}
	if resp.Questions[0].QuestionID != store.questions[0].ID || resp.Questions[0].ID != store.questions[0].ID || resp.Questions[0].Index != 0 {
		t.Fatalf("unexpected question id: %+v", resp.Questions[0])
	}
	if resp.Questions[0].SourceFilePath == "" {
		t.Fatalf("expected source file path for exam-safe question payload, got %+v", resp.Questions[0])
	}
}

func TestCreateExamAllowsDocumentedAnalysisOnlyRequest(t *testing.T) {
	store := &fakeStore{
		repositoryID: "00000000-0000-0000-0000-000000000300",
		questions:    makeQuestionSet(),
	}
	service := NewService(store, 14, "Friday")

	resp, err := service.CreateExam(context.Background(), "00000000-0000-0000-0000-000000000100", CreateExamRequest{
		AnalysisJobID: "00000000-0000-0000-0000-000000000400",
	})
	if err != nil {
		t.Fatalf("CreateExam returned error: %v", err)
	}
	if resp.AnalysisJobID != "00000000-0000-0000-0000-000000000400" || resp.QuestionCount != QuestionCount || resp.Status != StatusScheduled {
		t.Fatalf("unexpected create response: %+v", resp)
	}
}

func TestListSucceededProjectsMapsPreparationAndExamState(t *testing.T) {
	store := &fakeStore{
		connection: TomorrowConnection{
			Username:    "student-user",
			RemoteToken: "remote-jwt",
		},
		questions: makeQuestionSet(),
		prepJobs: []PreparationJob{
			{
				ProjectSlug: "ascii-art",
				Status:      PreparationJobDownloading,
				CreatedAt:   time.Date(2026, 6, 20, 10, 0, 0, 0, time.UTC),
			},
		},
		repositories: []SucceededProjectRepositoryRecord{
			{
				RepositoryID:         "00000000-0000-0000-0000-000000000401",
				ProjectPath:          "student/go-reloaded",
				LatestAnalysisJobID:  "00000000-0000-0000-0000-000000000402",
				LatestAnalysisStatus: "completed",
			},
		},
		exams: []Exam{
			{
				ID:          "00000000-0000-0000-0000-000000000202",
				ProjectSlug: "group/forum",
				Status:      StatusPassed,
				Passed:      boolPtr(true),
				CreatedAt:   time.Date(2026, 6, 22, 10, 0, 0, 0, time.UTC),
			},
		},
	}

	service := NewServiceWithDependencies(store, 14, "Friday", nil, fakeSucceededProjectSource{
		projects: []tomorrow.Project{
			{Slug: "go-reloaded", Name: "Go Reloaded", RepoURL: "https://example.com/git/student-user/go-reloaded", Status: "Project succeeded", IsSucceeded: true},
			{Slug: "ascii-art", Name: "Ascii Art", RepoURL: "https://example.com/git/student-user/ascii-art", Status: "Project succeeded", IsSucceeded: true},
			{Slug: "forum", Name: "Forum", RepoURL: "https://example.com/git/student-user/forum", Status: "Project succeeded", IsSucceeded: true},
			{Slug: "unprepared", Name: "Unprepared", RepoURL: "https://example.com/git/student-user/unprepared", Status: "Project succeeded", IsSucceeded: true},
		},
	})

	resp, err := service.ListSucceededProjects(context.Background(), "00000000-0000-0000-0000-000000000100")
	if err != nil {
		t.Fatalf("ListSucceededProjects returned error: %v", err)
	}
	if len(resp.Projects) != 4 {
		t.Fatalf("expected 4 succeeded projects, got %d", len(resp.Projects))
	}

	got := map[string]SucceededProject{}
	for _, project := range resp.Projects {
		got[project.ProjectSlug] = project
	}
	if got["go-reloaded"].PreparationStatus != SucceededProjectStateReady || got["go-reloaded"].ExamID == "" {
		t.Fatalf("go-reloaded = %+v, want ready project with exam id", got["go-reloaded"])
	}
	if got["ascii-art"].PreparationStatus != SucceededProjectStatePreparing {
		t.Fatalf("ascii-art = %+v, want preparing", got["ascii-art"])
	}
	if got["forum"].PreparationStatus != SucceededProjectStatePassed {
		t.Fatalf("forum = %+v, want passed", got["forum"])
	}
	if got["unprepared"].PreparationStatus != SucceededProjectStateNotPrepared {
		t.Fatalf("unprepared = %+v, want not_started", got["unprepared"])
	}
}

func TestStartSucceededProjectPreparationQueuesRepoDownloadJob(t *testing.T) {
	store := &fakeStore{
		connection: TomorrowConnection{
			Username:    "student-user",
			RemoteToken: "remote-jwt",
		},
	}
	publisher := &fakeRepoDownloadPublisher{}
	service := NewServiceWithProjectPreparation(store, 14, "Friday", publisher, fakeSucceededProjectSource{
		projects: []tomorrow.Project{
			{Slug: "forum", Name: "Forum", RepoURL: "https://example.com/git/student-user/forum", Status: "Project succeeded", IsSucceeded: true},
		},
	}, nil)

	resp, err := service.StartSucceededProjectPreparation(context.Background(), "00000000-0000-0000-0000-000000000100", "forum")
	if err != nil {
		t.Fatalf("StartSucceededProjectPreparation returned error: %v", err)
	}
	if resp.ProjectSlug != "forum" || resp.PreparationStatus != SucceededProjectStatePreparing || resp.AttemptID == "" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if len(publisher.messages) != 1 {
		t.Fatalf("expected one repo download job to be published, got %d", len(publisher.messages))
	}
	if publisher.messages[0].ProjectSlug != "forum" || publisher.messages[0].RepoURL == "" || publisher.messages[0].AttemptID == "" {
		t.Fatalf("unexpected published message: %+v", publisher.messages[0])
	}
}

func TestStartSucceededProjectPreparationRejectsAlreadyPassedProject(t *testing.T) {
	store := &fakeStore{
		connection: TomorrowConnection{
			Username:    "student-user",
			RemoteToken: "remote-jwt",
		},
		exams: []Exam{
			{
				ID:          "00000000-0000-0000-0000-000000000202",
				ProjectSlug: "group/go-reloaded",
				Status:      StatusPassed,
				Passed:      boolPtr(true),
				CreatedAt:   time.Date(2026, 6, 22, 10, 0, 0, 0, time.UTC),
			},
		},
	}
	publisher := &fakeRepoDownloadPublisher{}
	service := NewServiceWithProjectPreparation(store, 14, "Friday", publisher, fakeSucceededProjectSource{
		projects: []tomorrow.Project{
			{Slug: "go-reloaded", Name: "Go Reloaded", RepoURL: "https://example.com/git/student-user/go-reloaded", Status: "Project succeeded", IsSucceeded: true},
		},
	}, nil)

	_, err := service.StartSucceededProjectPreparation(context.Background(), "00000000-0000-0000-0000-000000000100", "go-reloaded")
	if err == nil {
		t.Fatal("expected already passed project to reject preparation")
	}

	var appErr *AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected app error, got %v", err)
	}
	if appErr.Code != ErrCodeAlreadySubmitted {
		t.Fatalf("unexpected error code %q", appErr.Code)
	}
	if len(publisher.messages) != 0 {
		t.Fatalf("expected no repo download job to be published, got %d", len(publisher.messages))
	}
}

func boolPtr(value bool) *bool {
	return &value
}

func makeQuestionSet() []Question {
	questions := make([]Question, 0, QuestionCount)
	for i := 1; i <= QuestionCount; i++ {
		questions = append(questions, Question{
			ID:            questionUUID(i),
			AnalysisJobID: "00000000-0000-0000-0000-000000000400",
			Question:      "Question",
			OptionA:       "A",
			OptionB:       "B",
			OptionC:       "C",
			OptionD:       "D",
			CorrectOption: OptionA,
			Explanation:   "Explanation",
			Difficulty:    "medium",
		})
	}
	return questions
}

func questionUUID(index int) string {
	return [...]string{
		"00000000-0000-0000-0000-000000000001",
		"00000000-0000-0000-0000-000000000002",
		"00000000-0000-0000-0000-000000000003",
		"00000000-0000-0000-0000-000000000004",
		"00000000-0000-0000-0000-000000000005",
		"00000000-0000-0000-0000-000000000006",
		"00000000-0000-0000-0000-000000000007",
		"00000000-0000-0000-0000-000000000008",
		"00000000-0000-0000-0000-000000000009",
		"00000000-0000-0000-0000-000000000010",
		"00000000-0000-0000-0000-000000000011",
		"00000000-0000-0000-0000-000000000012",
		"00000000-0000-0000-0000-000000000013",
		"00000000-0000-0000-0000-000000000014",
		"00000000-0000-0000-0000-000000000015",
		"00000000-0000-0000-0000-000000000016",
		"00000000-0000-0000-0000-000000000017",
		"00000000-0000-0000-0000-000000000018",
		"00000000-0000-0000-0000-000000000019",
		"00000000-0000-0000-0000-000000000020",
	}[index-1]
}
