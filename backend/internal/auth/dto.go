package auth

import (
	"encoding/json"
	"strings"
)

// RegisterRequest is the POST /auth/register request body.
type RegisterRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// LoginRequest is the POST /auth/login request body.
type LoginRequest struct {
	Credential string `json:"credential"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

func (r *LoginRequest) UnmarshalJSON(data []byte) error {
	type rawLoginRequest struct {
		Credential string `json:"credential"`
		Email      string `json:"email"`
		Username   string `json:"username"`
		Name       string `json:"name"`
		Password   string `json:"password"`
	}

	var raw rawLoginRequest
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	r.Credential = firstNonEmptyTrimmed(raw.Credential, raw.Username, raw.Name, raw.Email)
	r.Email = strings.TrimSpace(raw.Email)
	r.Password = raw.Password
	return nil
}

func firstNonEmptyTrimmed(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// AuthResponse is returned by registration and login.
type AuthResponse struct {
	User        PublicUser `json:"user"`
	AccessToken string     `json:"access_token"`
}

// MeResponse is returned by GET /auth/me.
type MeResponse struct {
	User PublicUser `json:"user"`
}

// MessageResponse is returned by compatibility endpoints such as logout.
type MessageResponse struct {
	Message string `json:"message"`
}
