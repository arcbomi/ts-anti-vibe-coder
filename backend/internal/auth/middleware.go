package auth

import (
	"context"
	"net/http"
	"strings"

	sdkerrors "backend/pkg/sdk/errors"
)

type currentUserContextKey struct{}

// RequireAuth validates a bearer token and stores the public user in context.
func RequireAuth(service *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := BearerToken(r)
			if token == "" {
				sdkerrors.WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Bearer token is required")
				return
			}
			user, err := service.CurrentUser(r.Context(), token)
			if err != nil {
				writeAuthError(w, err)
				return
			}
			ctx := context.WithValue(r.Context(), currentUserContextKey{}, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// CurrentUserFromContext returns the authenticated public user saved by RequireAuth.
func CurrentUserFromContext(ctx context.Context) (PublicUser, bool) {
	user, ok := ctx.Value(currentUserContextKey{}).(PublicUser)
	return user, ok
}

// BearerToken extracts a bearer token from the Authorization header.
func BearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return ""
	}
	return strings.TrimSpace(header[len("Bearer "):])
}
