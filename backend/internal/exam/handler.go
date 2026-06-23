package exam

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
	service       Service
	internalToken string
}

func NewHandler(service Service, internalToken string) *Handler {
	return &Handler{service: service, internalToken: strings.TrimSpace(internalToken)}
}

func (h *Handler) CreateExam(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	var req CreateExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeBadRequest, "Request body must be valid JSON.")
		return
	}
	resp, err := h.service.CreateExam(r.Context(), userID, req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetExam(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	resp, err := h.service.GetExam(r.Context(), userID, chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetQuestions(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	resp, err := h.service.GetQuestions(r.Context(), userID, chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) SubmitExam(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	var req SubmitExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeBadRequest, "Request body must be valid JSON.")
		return
	}
	resp, err := h.service.SubmitExam(r.Context(), userID, chi.URLParam(r, "id"), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetResult(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	resp, err := h.service.GetResult(r.Context(), userID, chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) ListSucceededProjects(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	resp, err := h.service.ListSucceededProjects(r.Context(), userID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) StartSucceededProjectPreparation(w http.ResponseWriter, r *http.Request) {
	userID, ok := currentUserID(r)
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	resp, err := h.service.StartSucceededProjectPreparation(r.Context(), userID, chi.URLParam(r, "slug"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) PrepareSucceededProject(w http.ResponseWriter, r *http.Request) {
	if !h.isInternalRequest(r) {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Internal service authentication is required.")
		return
	}
	var req PrepareSucceededProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeBadRequest, "Request body must be valid JSON.")
		return
	}
	resp, err := h.service.PrepareSucceededProject(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func writeServiceError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		sdkerrors.WriteError(w, appErr.HTTPStatus, appErr.Code, appErr.Message)
		return
	}
	sdkerrors.WriteError(w, http.StatusInternalServerError, ErrCodeDatabase, "Internal server error.")
}

func currentUserID(r *http.Request) (string, bool) {
	user, ok := middleware.CurrentAuthenticatedUser(r.Context())
	if !ok || user.UserID == "" {
		return "", false
	}
	return user.UserID, true
}

func (h *Handler) isInternalRequest(r *http.Request) bool {
	if h.internalToken == "" {
		return false
	}
	if subtleEqual(r.Header.Get("X-Internal-Service-Token"), h.internalToken) {
		return true
	}
	bearer := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	return subtleEqual(bearer, h.internalToken)
}

func subtleEqual(a, b string) bool {
	if len(a) != len(b) || a == "" {
		return false
	}
	var v byte
	for i := range a {
		v |= a[i] ^ b[i]
	}
	return v == 0
}
