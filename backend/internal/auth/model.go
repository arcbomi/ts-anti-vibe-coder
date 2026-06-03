package auth

import "time"

// User is the persistent auth user record. PasswordHash is never serialized.
type User struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	AuthProvider string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// PublicUser is the user shape exposed by auth APIs and other services.
type PublicUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func toPublicUser(user User) PublicUser {
	return PublicUser{ID: user.ID, Email: user.Email, Name: user.Name}
}
