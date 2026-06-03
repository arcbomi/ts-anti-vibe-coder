package analysis

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeAIClient struct {
	responses []json.RawMessage
	prompts   []string
}

func (f *fakeAIClient) GenerateJSON(_ context.Context, prompt string) (json.RawMessage, error) {
	f.prompts = append(f.prompts, prompt)
	if len(f.responses) == 0 {
		return nil, context.Canceled
	}
	response := f.responses[0]
	f.responses = f.responses[1:]
	return response, nil
}

func TestHandlerGenerateQuestionsRunsAnalysisFlow(t *testing.T) {
	ai := &fakeAIClient{responses: []json.RawMessage{
		json.RawMessage(`{"repository_summary":"API service","project_type":"backend","languages":["Go"],"frameworks":["net/http"],"entry_points":[],"important_modules":[],"code_flows":[],"question_topics":[]}`),
		questionsEnvelope(t),
	}}
	handler := NewHandler(NewService(ai)).Routes()
	body := bytes.NewBufferString(`{
		"repository_id":"repo-1",
		"gitlab_repository_url":"https://gitlab.example.com/group/project",
		"branch_name":"main",
		"repository_file_tree":["cmd/server/main.go"],
		"selected_source_files":[{"path":"cmd/server/main.go","size":12,"content":"package main\n"}]
	}`)
	req := httptest.NewRequest(http.MethodPost, "/analysis/generate-questions", body)
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("X-User-Id", "user-1")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", res.Code, res.Body.String())
	}
	if len(ai.prompts) != 2 {
		t.Fatalf("GenerateJSON called %d times, want 2", len(ai.prompts))
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"questions"`)) {
		t.Fatalf("response did not include generated questions: %s", res.Body.String())
	}
}

func questionsEnvelope(t *testing.T) json.RawMessage {
	t.Helper()
	questions := make([]GeneratedQuestion, 20)
	for i := range questions {
		questions[i] = GeneratedQuestion{
			Question:       "How does the server start?",
			OptionA:        "It starts from main.",
			OptionB:        "It starts from assets.",
			OptionC:        "It starts from CSS.",
			OptionD:        "It starts from logs.",
			CorrectOption:  "A",
			Explanation:    "The entry point starts the server.",
			Difficulty:     "medium",
			SourceFilePath: "cmd/server/main.go",
		}
	}
	payload, err := json.Marshal(struct {
		Questions []GeneratedQuestion `json:"questions"`
	}{Questions: questions})
	if err != nil {
		t.Fatal(err)
	}
	return payload
}
