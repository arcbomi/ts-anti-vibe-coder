package auth

// RegisterRequest is the POST /auth/register request body.
type RegisterRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// LoginRequest is the POST /auth/login request body.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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
