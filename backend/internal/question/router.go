package question

import (
	"net/http"

	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/middleware"

	"github.com/go-chi/chi/v5"
)

func NewRouter(handler *Handler, validator *authn.Validator) http.Handler {
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireInternalToken(handler.internalToken))
		r.Post("/questions/generated", handler.SaveGeneratedQuestions)
		r.Get("/internal/exams/{examId}/answer-key", handler.GetAnswerKey)
	})
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireJWTIdentity(validator))
		r.Get("/analysis-jobs/{analysisJobId}/questions", handler.GetQuestionsByAnalysisJob)
		r.Get("/exams/{examId}/questions", handler.GetExamQuestions)
	})
	return r
}
