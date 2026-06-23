package auth

import (
	"strings"
	"time"
)

// User is the persistent auth user record. PasswordHash is never serialized.
type User struct {
	ID              string
	Email           string
	Name            string
	FirstName       string
	LastName        string
	Username        string
	LoginCredential string
	LoginPassword   string
	PasswordHash    string
	AuthProvider    string
	RemoteToken     string
	ProfilePath     string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// PublicUser is the user shape exposed by auth APIs and other services.
type PublicUser struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	FullName  string `json:"full_name"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username,omitempty"`
}

type TomorrowConnection struct {
	Username        string
	RemoteToken     string
	ProfilePath     string
	LoginCredential string
	LoginPassword   string
}

func toPublicUser(user User) PublicUser {
	firstName, lastName := normalizedNameParts(user.FirstName, user.LastName, user.Name)
	fullName := firstNonEmptyTrimmed(displayNameFromParts(firstName, lastName), user.Name)
	return PublicUser{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		FullName:  fullName,
		FirstName: firstName,
		LastName:  lastName,
		Username:  firstNonEmptyTrimmed(user.Username),
	}
}

func normalizedNameParts(firstName, lastName, displayName string) (string, string) {
	firstName = firstNonEmptyTrimmed(firstName)
	lastName = firstNonEmptyTrimmed(lastName)
	if firstName != "" || lastName != "" {
		return firstName, lastName
	}

	displayName = firstNonEmptyTrimmed(displayName)
	if displayName == "" {
		return "", ""
	}

	parts := strings.Fields(displayName)
	if len(parts) == 0 {
		return "", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return parts[0], strings.Join(parts[1:], " ")
}
