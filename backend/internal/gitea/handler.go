package gitea

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

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
	r.Get("/repositories", h.listRepositories)
	r.Post("/repositories/sync-tomorrow", h.syncTomorrowProjects)
	r.Post("/repositories", h.createRepository)
	r.Post("/repositories/{id}/check-bot-access", h.checkBotAccess)
	r.Post("/repositories/{id}/start-analysis", h.startAnalysis)
	r.Get("/repositories/{id}", h.getRepository)
	r.Get("/analysis-jobs/{id}", h.getAnalysisJob)
	return r
}

type createRepositoryRequest struct {
	GiteaRepoURL string `json:"gitea_repo_url"`
}

type createRepositoryResponse struct {
	ID              string `json:"id"`
	RepositoryID    string `json:"repository_id"`
	GiteaRepoURL    string `json:"gitea_repo_url"`
	BotAccessStatus string `json:"bot_access_status"`
}

type checkBotAccessResponse struct {
	ID              string `json:"id"`
	RepositoryID    string `json:"repository_id"`
	BotAccessStatus string `json:"bot_access_status"`
	Message         string `json:"message"`
}

type startAnalysisResponse struct {
	ID            string `json:"id"`
	AnalysisJobID string `json:"analysis_job_id"`
	Status        string `json:"status"`
}

type repositoryResponse struct {
	ID                         string     `json:"id"`
	RepositoryID               string     `json:"repository_id"`
	GiteaRepoURL               string     `json:"gitea_repo_url"`
	GiteaProjectPath           string     `json:"gitea_project_path,omitempty"`
	TomorrowAuditText          string     `json:"tomorrow_audit_text,omitempty"`
	DefaultBranch              string     `json:"default_branch,omitempty"`
	BotAccessStatus            string     `json:"bot_access_status"`
	CreatedAt                  string     `json:"created_at,omitempty"`
	UpdatedAt                  string     `json:"updated_at,omitempty"`
	LatestAnalysisJobID        *string    `json:"latest_analysis_job_id,omitempty"`
	LatestAnalysisStatus       *string    `json:"latest_analysis_status,omitempty"`
	LatestAnalysisErrorMessage *string    `json:"latest_analysis_error_message,omitempty"`
	LatestAnalysisJob          *jobRefDTO `json:"latest_analysis_job,omitempty"`
}

type analysisJobResponse struct {
	ID            string  `json:"id"`
	AnalysisJobID string  `json:"analysis_job_id"`
	RepositoryID  string  `json:"repository_id,omitempty"`
	Status        string  `json:"status"`
	ErrorMessage  *string `json:"error_message,omitempty"`
	CreatedAt     string  `json:"created_at,omitempty"`
	CompletedAt   string  `json:"completed_at,omitempty"`
}

type jobRefDTO struct {
	ID string `json:"id"`
}

func (h *Handler) createRepository(w http.ResponseWriter, r *http.Request) {
	var req createRepositoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeInvalidRepositoryURL, "The repository URL is invalid.")
		return
	}
	repo, err := h.service.CreateRepository(r.Context(), userIDFromRequest(r), req.GiteaRepoURL)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, createRepositoryResponse{ID: repo.ID, RepositoryID: repo.ID, GiteaRepoURL: repo.GiteaRepoURL, BotAccessStatus: repo.BotAccessStatus})
}

func (h *Handler) listRepositories(w http.ResponseWriter, r *http.Request) {
	repositories, err := h.service.ListRepositories(r.Context(), userIDFromRequest(r))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response := make([]repositoryResponse, 0, len(repositories))
	for i := range repositories {
		repo := repositories[i]
		response = append(response, newRepositoryResponse(&repo))
	}
	sdkerrors.WriteSuccess(w, response)
}

func (h *Handler) syncTomorrowProjects(w http.ResponseWriter, r *http.Request) {
	repositories, err := h.service.SyncTomorrowProjects(r.Context(), userIDFromRequest(r))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response := make([]repositoryResponse, 0, len(repositories))
	for i := range repositories {
		repo := repositories[i]
		response = append(response, newRepositoryResponse(&repo))
	}
	sdkerrors.WriteSuccess(w, response)
}

func (h *Handler) checkBotAccess(w http.ResponseWriter, r *http.Request) {
	repo, err := h.service.CheckBotAccess(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, checkBotAccessResponse{ID: repo.ID, RepositoryID: repo.ID, BotAccessStatus: repo.BotAccessStatus, Message: "Bot access confirmed."})
}

func (h *Handler) startAnalysis(w http.ResponseWriter, r *http.Request) {
	job, err := h.service.StartAnalysis(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, startAnalysisResponse{ID: job.ID, AnalysisJobID: job.ID, Status: job.Status})
}

func (h *Handler) getRepository(w http.ResponseWriter, r *http.Request) {
	repo, err := h.service.GetRepository(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, newRepositoryResponse(repo))
}

func (h *Handler) getAnalysisJob(w http.ResponseWriter, r *http.Request) {
	job, err := h.service.GetAnalysisJob(r.Context(), userIDFromRequest(r), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, newAnalysisJobResponse(job))
}

func userIDFromRequest(r *http.Request) string {
	if user, ok := middleware.CurrentAuthenticatedUser(r.Context()); ok {
		return user.UserID
	}
	return ""
}

func writeServiceError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		sdkerrors.WriteError(w, appErr.HTTPStatus, appErr.Code, appErr.Message)
		return
	}
	sdkerrors.WriteError(w, http.StatusInternalServerError, ErrCodeInternal, "Internal server error.")
}

func newRepositoryResponse(repo *Repository) repositoryResponse {
	if repo == nil {
		return repositoryResponse{}
	}
	resp := repositoryResponse{
		ID:                         repo.ID,
		RepositoryID:               repo.ID,
		GiteaRepoURL:               repo.GiteaRepoURL,
		GiteaProjectPath:           repo.GiteaProjectPath,
		TomorrowAuditText:          repo.TomorrowAuditText,
		DefaultBranch:              repo.DefaultBranch,
		BotAccessStatus:            repo.BotAccessStatus,
		CreatedAt:                  repo.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:                  repo.UpdatedAt.UTC().Format(time.RFC3339),
		LatestAnalysisJobID:        repo.LatestAnalysisJobID,
		LatestAnalysisStatus:       repo.LatestAnalysisStatus,
		LatestAnalysisErrorMessage: repo.LatestAnalysisErrorMessage,
	}
	if repo.LatestAnalysisJobID != nil && *repo.LatestAnalysisJobID != "" {
		resp.LatestAnalysisJob = &jobRefDTO{ID: *repo.LatestAnalysisJobID}
	}
	return resp
}

func newAnalysisJobResponse(job *AnalysisJob) analysisJobResponse {
	if job == nil {
		return analysisJobResponse{}
	}
	resp := analysisJobResponse{
		ID:            job.ID,
		AnalysisJobID: job.ID,
		RepositoryID:  job.RepositoryID,
		Status:        job.Status,
		ErrorMessage:  job.ErrorMessage,
		CreatedAt:     job.CreatedAt.UTC().Format(time.RFC3339),
	}
	if job.CompletedAt != nil {
		completedAt := job.CompletedAt.UTC().Format(time.RFC3339)
		resp.CompletedAt = completedAt
	}
	return resp
}
