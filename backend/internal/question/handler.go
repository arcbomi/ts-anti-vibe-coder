package question

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	sdkerrors "backend/pkg/sdk/errors"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service       Service
	internalToken string
}

func NewHandler(service Service, internalToken string) *Handler {
	return &Handler{service: service, internalToken: strings.TrimSpace(internalToken)}
}

func (h *Handler) SaveGeneratedQuestions(w http.ResponseWriter, r *http.Request) {
	var req SaveGeneratedQuestionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, ErrCodeBadRequest, "Request body must be valid JSON.")
		return
	}
	resp, err := h.service.SaveGeneratedQuestions(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetQuestionsByAnalysisJob(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetQuestionsByAnalysisJob(r.Context(), chi.URLParam(r, "analysisJobId"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetExamQuestions(w http.ResponseWriter, r *http.Request) {
	resp, err := h.service.GetExamQuestions(r.Context(), chi.URLParam(r, "examId"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) GetAnswerKey(w http.ResponseWriter, r *http.Request) {
	if !h.isInternalRequest(r) {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Internal service authentication is required.")
		return
	}
	resp, err := h.service.GetAnswerKey(r.Context(), chi.URLParam(r, "examId"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
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

func writeServiceError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		sdkerrors.WriteError(w, appErr.HTTPStatus, appErr.Code, appErr.Message)
		return
	}
	sdkerrors.WriteError(w, http.StatusInternalServerError, ErrCodeInternal, "Internal server error.")
}
