//go:build integration
// +build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
)

type fakeAIServer struct {
	server  *httptest.Server
	invalid atomic.Bool
	calls   atomic.Int32
}

func newFakeAIServer() *fakeAIServer {
	f := &fakeAIServer{}
	f.server = httptest.NewServer(http.HandlerFunc(f.handle))
	return f
}
func (f *fakeAIServer) URL() string            { return f.server.URL }
func (f *fakeAIServer) Close()                 { f.server.Close() }
func (f *fakeAIServer) SetInvalidJSON(ok bool) { f.invalid.Store(ok) }
func (f *fakeAIServer) Calls() int             { return int(f.calls.Load()) }

func (f *fakeAIServer) handle(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/v1/chat/completions" {
		http.NotFound(w, r)
		return
	}
	call := f.calls.Add(1)
	content := `{"repository_summary":"Fake Go HTTP API","project_type":"backend","languages":["Go"],"frameworks":["net/http"],"entry_points":[{"file_path":"cmd/server/main.go","description":"Starts HTTP server."}],"important_modules":[],"code_flows":[],"question_topics":["routes","handlers","services"]}`
	if call%2 == 0 {
		if f.invalid.Load() {
			content = `{"questions":[`
		} else {
			b, _ := json.Marshal(map[string]any{"questions": fakeQuestions()})
			content = string(b)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"choices": []map[string]any{{"message": map[string]string{"role": "assistant", "content": content}}}})
}

func fakeQuestions() []map[string]any {
	qs := make([]map[string]any, 20)
	for i := 0; i < 20; i++ {
		qs[i] = map[string]any{
			"question":         fmt.Sprintf("How does request flow number %02d connect routes, handlers, and services in this repository?", i+1),
			"option_a":         "Routes are generated from database records.",
			"option_b":         "A mux route calls a handler, and the handler calls the user service.",
			"option_c":         "The frontend directly writes user records.",
			"option_d":         "The compiler creates HTTP handlers automatically.",
			"correct_option":   "B",
			"explanation":      "The router manually registers the handler, the handler parses JSON, and then delegates to service code.",
			"difficulty":       []string{"easy", "medium", "hard"}[i%3],
			"source_file_path": []string{"internal/server/router.go", "internal/handler/user_handler.go", "internal/service/user_service.go"}[i%3],
		}
	}
	return qs
}

func isEnglishASCII(s string) bool {
	return strings.IndexFunc(s, func(r rune) bool { return r > 127 }) == -1
}
