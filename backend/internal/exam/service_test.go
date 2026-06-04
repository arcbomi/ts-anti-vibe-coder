package exam

import (
	"context"
	"testing"
	"time"
)

type fakeStore struct {
	exam         Exam
	questions    []Question
	repositoryID string
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

func (f *fakeStore) CountCorrectAnswers(context.Context, string) (int, error) {
	return 0, nil
}

func TestNewServiceDefaultsToFridayWhenUnset(t *testing.T) {
	svc := NewService(nil, 70, "")
	if svc.examOpenDOW != time.Friday {
		t.Fatalf("examOpenDOW = %s, want Friday", svc.examOpenDOW)
	}
}

func TestNewServiceFallsBackToFridayForInvalidDay(t *testing.T) {
	svc := NewService(nil, 70, "noday")
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
			OptionD:        "It mutates GitLab.",
			CorrectOption:  OptionA,
			Explanation:    "Handlers parse requests before calling services.",
			Difficulty:     "medium",
			SourceFilePath: "internal/handler/user_handler.go",
		}},
	}
	service := NewService(store, 70, "Friday")

	resp, err := service.GetExam(context.Background(), store.exam.UserID, store.exam.ID)
	if err != nil {
		t.Fatalf("GetExam returned error: %v", err)
	}
	if resp.ID != store.exam.ID || resp.ExamID != store.exam.ID {
		t.Fatalf("expected both exam ids, got %+v", resp)
	}
	if len(resp.Questions) != 1 {
		t.Fatalf("expected one question, got %d", len(resp.Questions))
	}
	if resp.Questions[0].QuestionID != store.questions[0].ID {
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
	service := NewService(store, 70, "Friday")

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
