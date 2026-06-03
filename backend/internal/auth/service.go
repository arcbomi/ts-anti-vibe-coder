package auth

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/google/uuid"
)

var (
	ErrInvalidRequest     = errors.New("invalid request")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrUserNotFound       = errors.New("user not found")
)

// Service contains authentication business logic only.
type Service struct {
	repository *Repository
	tokens     *TokenManager
}

func NewService(repository *Repository, tokens *TokenManager) *Service {
	return &Service{repository: repository, tokens: tokens}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (AuthResponse, error) {
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return AuthResponse{}, fmt.Errorf("%w: invalid email", ErrInvalidRequest)
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return AuthResponse{}, fmt.Errorf("%w: name is required", ErrInvalidRequest)
	}
	if len(req.Password) < minPasswordLength {
		return AuthResponse{}, fmt.Errorf("%w: password must be at least %d characters", ErrInvalidRequest, minPasswordLength)
	}

	if _, err := s.repository.GetUserByEmail(ctx, email); err == nil {
		return AuthResponse{}, ErrEmailAlreadyExists
	} else if !errors.Is(err, ErrUserNotFound) {
		return AuthResponse{}, err
	}

	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		return AuthResponse{}, err
	}
	user, err := s.repository.CreateUser(ctx, User{
		ID:           uuid.NewString(),
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
		AuthProvider: "local",
	})
	if err != nil {
		if looksLikeUniqueViolation(err) {
			return AuthResponse{}, ErrEmailAlreadyExists
		}
		return AuthResponse{}, err
	}

	token, err := s.tokens.Generate(user)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{User: toPublicUser(user), AccessToken: token}, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (AuthResponse, error) {
	email, err := normalizeEmail(req.Email)
	if err != nil || strings.TrimSpace(req.Password) == "" {
		return AuthResponse{}, ErrInvalidCredentials
	}
	user, err := s.repository.GetUserByEmail(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		return AuthResponse{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResponse{}, err
	}
	if !VerifyPassword(req.Password, user.PasswordHash) {
		return AuthResponse{}, ErrInvalidCredentials
	}

	token, err := s.tokens.Generate(user)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{User: toPublicUser(user), AccessToken: token}, nil
}

func (s *Service) CurrentUser(ctx context.Context, token string) (PublicUser, error) {
	claims, err := s.tokens.Validate(token)
	if err != nil {
		return PublicUser{}, err
	}
	user, err := s.repository.GetUserByID(ctx, claims.Subject)
	if errors.Is(err, ErrUserNotFound) {
		return PublicUser{}, ErrTokenInvalid
	}
	if err != nil {
		return PublicUser{}, err
	}
	return toPublicUser(user), nil
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || !strings.Contains(email, "@") {
		return "", ErrInvalidRequest
	}
	return email, nil
}

func looksLikeUniqueViolation(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") || strings.Contains(message, "duplicate")
}
