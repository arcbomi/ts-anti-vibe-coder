package gitlab

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	sdkerrors "backend/pkg/sdk/errors"
	"backend/pkg/sdk/middleware"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Auth)
	r.Post("/repositories", h.createRepository)
	r.Post("/repositories/{id}/check-bot-access", h.checkBotAccess)
	r.Post("/repositories/{id}/start-analysis", h.startAnalysis)
	r.Get("/repositories/{id}", h.getRepository)
	return r
}

type createRepositoryRequest struct {
	GitLabRepoURL string `json:"gitlab_repo_url"`
}

type createRepositoryResponse struct {
	RepositoryID    string `json:"repository_id"`
	GitLabRepoURL   string `json:"gitlab_repo_url"`
	BotAccessStatus string `json:"bot_access_status"`
}

type checkBotAccessResponse struct {
	RepositoryID    string `json:"repository_id"`
	BotAccessStatus string `json:"bot_access_status"`
	Message         string `json:"message"`
}

type startAnalysisResponse struct {
	AnalysisJobID string `json:"analysis_job_id"`
	Status        string `json:"status"`
}

func (h *Handler) createRepository(w http.ResponseWriter, r *http.Request) {
	var req createRepositoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeInvalidRepositoryURL, "The repository URL is invalid.")
		return
	}
	repo, err := h.service.CreateRepository(r.Context(), userIDFromRequest(r), req.GitLabRepoURL)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, createRepositoryResponse{RepositoryID: repo.ID, GitLabRepoURL: repo.GitLabRepoURL, BotAccessStatus: repo.BotAccessStatus})
}

func (h *Handler) checkBotAccess(w http.ResponseWriter, r *http.Request) {
	repo, err := h.service.CheckBotAccess(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, checkBotAccessResponse{RepositoryID: repo.ID, BotAccessStatus: repo.BotAccessStatus, Message: "Bot access confirmed."})
}

func (h *Handler) startAnalysis(w http.ResponseWriter, r *http.Request) {
	job, err := h.service.StartAnalysis(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, startAnalysisResponse{AnalysisJobID: job.ID, Status: job.Status})
}

func (h *Handler) getRepository(w http.ResponseWriter, r *http.Request) {
	repo, err := h.service.GetRepository(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, repo)
}

func userIDFromRequest(r *http.Request) string {
	if v := strings.TrimSpace(r.Header.Get("X-User-Id")); v != "" {
		return v
	}
	return middleware.BearerTokenFromContext(r.Context())
}

func writeServiceError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		sdkerrors.WriteError(w, appErr.HTTPStatus, appErr.Code, appErr.Message)
		return
	}
	sdkerrors.WriteError(w, http.StatusInternalServerError, ErrCodeInternal, "Internal server error.")
}
