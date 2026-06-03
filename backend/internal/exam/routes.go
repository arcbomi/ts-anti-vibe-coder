package exam

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func NewRouter(handler *Handler) http.Handler {
	r := chi.NewRouter()
	r.Post("/exams", handler.CreateExam)
	r.Get("/exams/{id}", handler.GetExam)
	r.Get("/exams/{id}/questions", handler.GetQuestions)
	r.Post("/exams/{id}/submit", handler.SubmitExam)
	r.Get("/exams/{id}/result", handler.GetResult)
	return r
}
