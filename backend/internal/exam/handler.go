package exam

import (
	"encoding/json"
	"errors"
	"net/http"

	sdkerrors "backend/pkg/sdk/errors"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateExam(w http.ResponseWriter, r *http.Request) {
	var req CreateExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeBadRequest, "Request body must be valid JSON.")
		return
	}
	resp, err := h.service.CreateExam(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetExam(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetExam(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetQuestions(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetQuestions(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) SubmitExam(w http.ResponseWriter, r *http.Request) {
	var req SubmitExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeBadRequest, "Request body must be valid JSON.")
		return
	}
	resp, err := h.service.SubmitExam(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetResult(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetResult(r.Context(), chi.URLParam(r, "id"))
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
