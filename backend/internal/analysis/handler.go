package analysis

import (
	"encoding/json"
	"net/http"
	"strings"

	sdkerrors "backend/pkg/sdk/errors"
	"backend/pkg/sdk/middleware"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service       *Service
	internalToken string
}

func NewHandler(service *Service, internalToken string) *Handler {
	return &Handler{service: service, internalToken: strings.TrimSpace(internalToken)}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireInternalToken(h.internalToken))
		r.Post("/analysis/generate-questions", h.generateQuestions)
	})
	return r
}

type generateQuestionsRequest struct {
	UserID         string           `json:"user_id"`
	RepositoryID   string           `json:"repository_id"`
	GiteaRepoURL   string           `json:"gitea_repository_url"`
	Branch         string           `json:"branch_name"`
	RepositoryTree []string         `json:"repository_file_tree"`
	Files          []RepositoryFile `json:"selected_source_files"`
}

type generateQuestionsResponse struct {
	Analysis  json.RawMessage     `json:"analysis"`
	Questions []GeneratedQuestion `json:"questions"`
}

func (h *Handler) generateQuestions(w http.ResponseWriter, r *http.Request) {
	if h == nil || h.service == nil {
		sdkerrors.WriteError(w, http.StatusInternalServerError, "ANALYSIS_SERVICE_UNAVAILABLE", "Analysis service is unavailable.")
		return
	}
	var req generateQuestionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, "INVALID_ANALYSIS_REQUEST", "Analysis request body must be valid JSON.")
		return
	}
	userID := strings.TrimSpace(req.UserID)
	if headerUserID := strings.TrimSpace(r.Header.Get("X-User-Id")); headerUserID != "" {
		userID = headerUserID
	}
	input := RepositoryInput{
		UserID:         userID,
		RepositoryID:   req.RepositoryID,
		GiteaRepoURL:   req.GiteaRepoURL,
		Branch:         req.Branch,
		RepositoryTree: req.RepositoryTree,
		Files:          req.Files,
	}
	if err := validateRepositoryInput(input); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, "INVALID_ANALYSIS_REQUEST", err.Error())
		return
	}
	result, err := h.service.GenerateExamQuestions(r.Context(), input)
	if err != nil {
		sdkerrors.WriteError(w, http.StatusBadGateway, "AI_GENERATION_FAILED", "Unable to analyze repository and generate questions.")
		return
	}
	sdkerrors.WriteSuccess(w, generateQuestionsResponse{Analysis: result.Analysis, Questions: result.Questions})
}

func validateRepositoryInput(input RepositoryInput) error {
	if strings.TrimSpace(input.UserID) == "" {
		return errInvalidInput("user_id is required")
	}
	if strings.TrimSpace(input.RepositoryID) == "" {
		return errInvalidInput("repository_id is required")
	}
	if strings.TrimSpace(input.GiteaRepoURL) == "" {
		return errInvalidInput("gitea_repository_url is required")
	}
	if len(input.Files) == 0 {
		return errInvalidInput("selected_source_files must include at least one source file")
	}
	return nil
}

type errInvalidInput string

func (e errInvalidInput) Error() string { return string(e) }
