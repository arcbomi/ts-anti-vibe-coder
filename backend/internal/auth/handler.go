package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	sdkerrors "backend/pkg/sdk/errors"

	"github.com/go-chi/chi/v5"
)

// Handler exposes auth HTTP endpoints.
type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Post("/logout", h.Logout)
		r.Group(func(r chi.Router) {
			r.Use(RequireAuth(h.service))
			r.Get("/me", h.Me)
		})
	})
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := decodeJSON(r, &req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body.")
		return
	}
	resp, err := h.service.Register(r.Context(), req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		sdkerrors.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body.")
		return
	}
	resp, err := h.service.Login(r.Context(), req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	sdkerrors.WriteSuccess(w, resp)
}

func (h *Handler) Logout(w http.ResponseWriter, _ *http.Request) {
	// Access tokens are stateless JWTs for MVP; clients should remove their token.
	// The endpoint remains for future refresh-token/session invalidation.
	sdkerrors.WriteSuccess(w, MessageResponse{Message: "Logged out successfully"})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := CurrentUserFromContext(r.Context())
	if !ok {
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
		return
	}
	sdkerrors.WriteSuccess(w, MeResponse{User: user})
}

func decodeJSON(r *http.Request, dest any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dest)
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidRequest):
		sdkerrors.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request.")
	case errors.Is(err, ErrInvalidCredentials):
		sdkerrors.WriteError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password.")
	case errors.Is(err, ErrEmailAlreadyExists):
		sdkerrors.WriteError(w, http.StatusConflict, "EMAIL_ALREADY_EXISTS", "Email already exists.")
	case errors.Is(err, ErrTokenExpired):
		sdkerrors.WriteError(w, http.StatusUnauthorized, "TOKEN_EXPIRED", "Token has expired.")
	case errors.Is(err, ErrTokenInvalid):
		sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication is required.")
	default:
		sdkerrors.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error.")
	}
}
