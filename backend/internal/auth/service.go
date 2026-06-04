package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"strings"

	"github.com/google/uuid"
)

var (
	ErrInvalidRequest       = errors.New("invalid request")
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrEmailAlreadyExists   = errors.New("email already exists")
	ErrUserNotFound         = errors.New("user not found")
	ErrAuthProviderFailed   = errors.New("authentication provider failed")
	ErrAuthProviderTimedOut = errors.New("authentication provider timed out")
)

type userRepository interface {
	CreateUser(ctx context.Context, user User) (User, error)
	GetUserByEmail(ctx context.Context, email string) (User, error)
	GetUserByID(ctx context.Context, id string) (User, error)
	UpdateUserForDevSeed(ctx context.Context, user User) (User, error)
	UpsertExternalUser(ctx context.Context, user User) (User, error)
}

type tokenManager interface {
	Generate(user User) (string, error)
	Validate(token string) (AccessClaims, error)
}

type ExternalIdentity struct {
	Email       string
	Name        string
	FullName    string
	FirstName   string
	LastName    string
	Username    string
	RemoteToken string
}

type ExternalAuthenticator interface {
	Authenticate(ctx context.Context, credential, password string) (ExternalIdentity, error)
}

// Service contains authentication business logic only.
type Service struct {
	repository    userRepository
	tokens        tokenManager
	authenticator ExternalAuthenticator
	log           *slog.Logger
}

func NewService(repository userRepository, tokens tokenManager, authenticator ExternalAuthenticator, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{repository: repository, tokens: tokens, authenticator: authenticator, log: log}
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
	credential := normalizeCredential(req)
	if credential == "" || strings.TrimSpace(req.Password) == "" {
		return AuthResponse{}, ErrInvalidCredentials
	}

	if s.authenticator == nil {
		return AuthResponse{}, ErrAuthProviderFailed
	}
	identity, err := s.authenticator.Authenticate(ctx, credential, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return AuthResponse{}, ErrInvalidCredentials
		}
		if errors.Is(err, ErrAuthProviderTimedOut) {
			s.log.Warn("external authentication timed out", "credential", credential)
			return AuthResponse{}, ErrAuthProviderTimedOut
		}
		s.log.Error("external authentication failed", "credential", credential, "err", err)
		return AuthResponse{}, ErrAuthProviderFailed
	}

	email, err := normalizeEmail(identity.Email)
	if err != nil {
		s.log.Error("external authentication succeeded without a valid email", "credential", credential)
		return AuthResponse{}, ErrAuthProviderFailed
	}

	user, err := s.repository.UpsertExternalUser(ctx, User{
		ID:           uuid.NewString(),
		Email:        email,
		Name:         deriveDisplayName(email, identity.Username, identity.Name, identity.FullName, identity.FirstName, identity.LastName),
		FirstName:    firstNonEmptyTrimmed(identity.FirstName),
		LastName:     firstNonEmptyTrimmed(identity.LastName),
		PasswordHash: "",
		AuthProvider: "tomorrow-school",
	})
	if err != nil {
		return AuthResponse{}, err
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
	publicUser := toPublicUser(user)
	if email := firstNonEmptyTrimmed(claims.Email); email != "" {
		publicUser.Email = email
	}
	if name := firstNonEmptyTrimmed(claims.Name); name != "" {
		publicUser.Name = name
	}
	firstName, lastName := normalizedNameParts(claims.FirstName, claims.LastName, publicUser.Name)
	publicUser.FirstName = firstName
	publicUser.LastName = lastName
	publicUser.FullName = firstNonEmptyTrimmed(displayNameFromParts(firstName, lastName), publicUser.Name)
	return publicUser, nil
}

func (s *Service) EnsureDevSeedUser(ctx context.Context, name, email, password string) error {
	email, err := normalizeEmail(email)
	if err != nil {
		return fmt.Errorf("%w: invalid email", ErrInvalidRequest)
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidRequest)
	}
	if len(password) < minPasswordLength {
		return fmt.Errorf("%w: password must be at least %d characters", ErrInvalidRequest, minPasswordLength)
	}

	passwordHash, err := HashPassword(password)
	if err != nil {
		return err
	}

	user := User{
		ID:           uuid.NewString(),
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
		AuthProvider: "local",
	}

	if _, err := s.repository.GetUserByEmail(ctx, email); errors.Is(err, ErrUserNotFound) {
		_, err = s.repository.CreateUser(ctx, user)
		return err
	} else if err != nil {
		return err
	}

	_, err = s.repository.UpdateUserForDevSeed(ctx, user)
	return err
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

func deriveDisplayName(email, username, name, fullName, firstName, lastName string) string {
	firstName = firstNonEmptyTrimmed(firstName)
	lastName = firstNonEmptyTrimmed(lastName)
	if firstName != "" && lastName != "" {
		return firstName + " " + lastName
	}
	if firstName != "" {
		return firstName
	}
	fullName = strings.TrimSpace(fullName)
	if fullName != "" {
		return fullName
	}
	name = strings.TrimSpace(name)
	if name != "" {
		return name
	}
	username = strings.TrimSpace(username)
	if username != "" {
		return username
	}
	localPart := strings.TrimSpace(strings.SplitN(email, "@", 2)[0])
	if localPart == "" {
		return "Tomorrow School User"
	}
	return localPart
}

func normalizeCredential(req LoginRequest) string {
	if credential := strings.TrimSpace(req.Credential); credential != "" {
		return credential
	}
	return strings.TrimSpace(req.Email)
}
