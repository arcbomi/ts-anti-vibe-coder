package exam

import (
	"net/http"

	"backend/pkg/sdk/authn"
	"backend/pkg/sdk/middleware"

	"github.com/go-chi/chi/v5"
)

func NewRouter(handler *Handler, validator *authn.Validator) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequireJWTIdentity(validator))
	r.Post("/exams", handler.CreateExam)
	r.Get("/exams/{id}", handler.GetExam)
	r.Get("/exams/{id}/questions", handler.GetQuestions)
	r.Post("/exams/{id}/submit", handler.SubmitExam)
	r.Get("/exams/{id}/result", handler.GetResult)
	return r
}
