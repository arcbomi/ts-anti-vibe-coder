package question

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func NewRouter(handler *Handler) http.Handler {
	r := chi.NewRouter()
	r.Post("/questions/generated", handler.SaveGeneratedQuestions)
	r.Get("/analysis-jobs/{analysisJobId}/questions", handler.GetQuestionsByAnalysisJob)
	r.Get("/exams/{examId}/questions", handler.GetExamQuestions)
	r.Get("/internal/exams/{examId}/answer-key", handler.GetAnswerKey)
	return r
}
