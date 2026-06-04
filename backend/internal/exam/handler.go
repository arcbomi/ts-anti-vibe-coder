package exam

import (
	"encoding/json"
	"errors"
	"net/http"

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
