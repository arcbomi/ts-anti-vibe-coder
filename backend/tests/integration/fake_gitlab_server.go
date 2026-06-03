package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"strings"
	"sync/atomic"
)

type fakeGitLabServer struct {
	server    *httptest.Server
	accessOK  atomic.Bool
	repoFiles map[string]string
}

func newFakeGitLabServer() *fakeGitLabServer {
	f := &fakeGitLabServer{repoFiles: map[string]string{
		"go.mod":                           "module fakeapp\n\ngo 1.24\n",
		"cmd/server/main.go":               "package main\n\nimport (\n  \"log\"\n  \"net/http\"\n  \"fakeapp/internal/server\"\n)\n\nfunc main() { router := server.NewRouter(); log.Fatal(http.ListenAndServe(\":8080\", router)) }\n",
		"internal/server/router.go":        "package server\n\nimport (\n  \"net/http\"\n  \"fakeapp/internal/handler\"\n  \"fakeapp/internal/service\"\n)\n\nfunc NewRouter() http.Handler { mux := http.NewServeMux(); userHandler := handler.NewUserHandler(service.NewUserService()); mux.HandleFunc(\"/users\", userHandler.CreateUser); return mux }\n",
		"internal/handler/user_handler.go": "package handler\n\nimport (\n  \"encoding/json\"\n  \"net/http\"\n  \"fakeapp/internal/service\"\n)\n\ntype UserHandler struct { service *service.UserService }\nfunc NewUserHandler(s *service.UserService) *UserHandler { return &UserHandler{service: s} }\nfunc (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) { var req struct{Name string `json:\"name\"`}; _ = json.NewDecoder(r.Body).Decode(&req); user := h.service.Create(req.Name); _ = json.NewEncoder(w).Encode(user) }\n",
		"internal/service/user_service.go": "package service\n\ntype User struct { ID string `json:\"id\"`; Name string `json:\"name\"` }\ntype UserService struct{}\nfunc NewUserService() *UserService { return &UserService{} }\nfunc (s *UserService) Create(name string) User { return User{ID: \"user-1\", Name: name} }\n",
	}}
	f.accessOK.Store(true)
	f.server = httptest.NewServer(http.HandlerFunc(f.handle))
	return f
}

func (f *fakeGitLabServer) URL() string       { return f.server.URL }
func (f *fakeGitLabServer) Close()            { f.server.Close() }
func (f *fakeGitLabServer) SetAccess(ok bool) { f.accessOK.Store(ok) }
func (f *fakeGitLabServer) RepoURL() string   { return f.server.URL + "/group/project" }

func (f *fakeGitLabServer) handle(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(r.Header.Get("PRIVATE-TOKEN")) == "" {
		http.Error(w, "missing bot token", http.StatusUnauthorized)
		return
	}
	p := strings.TrimPrefix(r.URL.Path, "/api/v4")
	if !strings.HasPrefix(p, "/projects/") {
		http.NotFound(w, r)
		return
	}
	if !f.accessOK.Load() {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	rest := strings.TrimPrefix(p, "/projects/")
	parts := strings.SplitN(rest, "/", 2)
	projectPath, _ := url.PathUnescape(parts[0])
	if projectPath != "group/project" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if len(parts) == 1 {
		_ = json.NewEncoder(w).Encode(map[string]any{"id": 101, "name": "project", "path_with_namespace": "group/project", "default_branch": "main", "web_url": f.RepoURL()})
		return
	}
	switch {
	case strings.HasPrefix(parts[1], "repository/tree"):
		nodes := make([]map[string]string, 0, len(f.repoFiles))
		for filePath := range f.repoFiles {
			nodes = append(nodes, map[string]string{"id": strings.ReplaceAll(filePath, "/", "-"), "name": path.Base(filePath), "type": "blob", "path": filePath, "mode": "100644"})
		}
		_ = json.NewEncoder(w).Encode(nodes)
	case strings.HasPrefix(parts[1], "repository/files/") && strings.HasSuffix(parts[1], "/raw"):
		encoded := strings.TrimSuffix(strings.TrimPrefix(parts[1], "repository/files/"), "/raw")
		filePath, _ := url.PathUnescape(encoded)
		content, ok := f.repoFiles[filePath]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte(content))
	default:
		http.NotFound(w, r)
	}
}
