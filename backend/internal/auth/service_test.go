package auth

import (
	"context"
	"errors"
	"testing"
)

type stubRepository struct {
	usersByEmail map[string]User
	usersByID    map[string]User
	upserted     []User
}

func newStubRepository() *stubRepository {
	return &stubRepository{
		usersByEmail: map[string]User{},
		usersByID:    map[string]User{},
	}
}

func (r *stubRepository) CreateUser(_ context.Context, user User) (User, error) {
	r.usersByEmail[user.Email] = user
	r.usersByID[user.ID] = user
	return user, nil
}

func (r *stubRepository) GetUserByEmail(_ context.Context, email string) (User, error) {
	user, ok := r.usersByEmail[email]
	if !ok {
		return User{}, ErrUserNotFound
	}
	return user, nil
}

func (r *stubRepository) GetUserByID(_ context.Context, id string) (User, error) {
	user, ok := r.usersByID[id]
	if !ok {
		return User{}, ErrUserNotFound
	}
	return user, nil
}

func (r *stubRepository) UpdateUserForDevSeed(_ context.Context, user User) (User, error) {
	r.usersByEmail[user.Email] = user
	r.usersByID[user.ID] = user
	return user, nil
}

func (r *stubRepository) UpsertExternalUser(_ context.Context, user User) (User, error) {
	if existing, ok := r.usersByEmail[user.Email]; ok {
		existing.Name = user.Name
		existing.FirstName = user.FirstName
		existing.LastName = user.LastName
		existing.Username = user.Username
		existing.LoginCredential = user.LoginCredential
		existing.LoginPassword = user.LoginPassword
		existing.RemoteToken = user.RemoteToken
		existing.AuthProvider = user.AuthProvider
		r.usersByEmail[user.Email] = existing
		r.usersByID[existing.ID] = existing
		r.upserted = append(r.upserted, existing)
		return existing, nil
	}
	r.usersByEmail[user.Email] = user
	r.usersByID[user.ID] = user
	r.upserted = append(r.upserted, user)
	return user, nil
}

type stubTokens struct{}

func (stubTokens) Generate(user User) (string, error) {
	return "token-for-" + user.ID, nil
}

func (stubTokens) Validate(string) (AccessClaims, error) {
	return AccessClaims{}, nil
}

type stubAuthenticator struct {
	identity ExternalIdentity
	err      error
}

func (s stubAuthenticator) Authenticate(_ context.Context, _, _ string) (ExternalIdentity, error) {
	if s.err != nil {
		return ExternalIdentity{}, s.err
	}
	return s.identity, nil
}

func TestServiceLoginSuccessUsesTomorrowSchoolAndIssuesInternalJWT(t *testing.T) {
	repo := newStubRepository()
	service := NewService(repo, stubTokens{}, stubAuthenticator{
		identity: ExternalIdentity{
			Email:       "student@example.com",
			Name:        "student-user",
			FullName:    "Student User",
			Username:    "student-user",
			RemoteToken: "remote-jwt",
		},
	}, nil)

	resp, err := service.Login(context.Background(), LoginRequest{
		Credential: "student@example.com",
		Password:   "correct-password",
	})
	if err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if resp.AccessToken == "" {
		t.Fatal("Login returned empty internal access token")
	}
	if resp.User.Email != "student@example.com" || resp.User.Name != "Student User" {
		t.Fatalf("Login returned wrong user: %+v", resp.User)
	}
	if resp.User.FullName != "Student User" {
		t.Fatalf("Login returned wrong user full name: %+v", resp.User)
	}
	if len(repo.upserted) != 1 || repo.upserted[0].AuthProvider != "tomorrow-school" || repo.upserted[0].PasswordHash != "" {
		t.Fatalf("Login did not upsert a tomorrow-school user: %+v", repo.upserted)
	}
	if repo.upserted[0].LoginCredential != "student@example.com" || repo.upserted[0].LoginPassword != "" {
		t.Fatalf("Login persisted unexpected clone credentials without cipher: %+v", repo.upserted[0])
	}
}

func TestServiceLoginInvalidCredentials(t *testing.T) {
	service := NewService(newStubRepository(), stubTokens{}, stubAuthenticator{err: ErrInvalidCredentials}, nil)

	_, err := service.Login(context.Background(), LoginRequest{
		Credential: "student@example.com",
		Password:   "wrong-password",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Login error = %v, want ErrInvalidCredentials", err)
	}
}

func TestServiceLoginRemoteFailure(t *testing.T) {
	service := NewService(newStubRepository(), stubTokens{}, stubAuthenticator{err: errors.New("remote exploded")}, nil)

	_, err := service.Login(context.Background(), LoginRequest{
		Credential: "student@example.com",
		Password:   "correct-password",
	})
	if !errors.Is(err, ErrAuthProviderFailed) {
		t.Fatalf("Login error = %v, want ErrAuthProviderFailed", err)
	}
}

func TestServiceLoginTimeoutHandling(t *testing.T) {
	service := NewService(newStubRepository(), stubTokens{}, stubAuthenticator{err: ErrAuthProviderTimedOut}, nil)

	_, err := service.Login(context.Background(), LoginRequest{
		Credential: "student@example.com",
		Password:   "correct-password",
	})
	if !errors.Is(err, ErrAuthProviderTimedOut) {
		t.Fatalf("Login error = %v, want ErrAuthProviderTimedOut", err)
	}
}

func TestServiceLoginAcceptsUsernameCredential(t *testing.T) {
	repo := newStubRepository()
	service := NewService(repo, stubTokens{}, stubAuthenticator{
		identity: ExternalIdentity{
			Email:       "student@example.com",
			Username:    "student-user",
			RemoteToken: "remote-jwt",
		},
	}, nil)

	resp, err := service.Login(context.Background(), LoginRequest{
		Credential: "student-user",
		Password:   "correct-password",
	})
	if err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if resp.User.Name != "student-user" {
		t.Fatalf("Login user name = %q, want username fallback", resp.User.Name)
	}
	if resp.User.FullName != "student-user" {
		t.Fatalf("Login user full_name = %q, want username fallback", resp.User.FullName)
	}
	if len(repo.upserted) != 1 || repo.upserted[0].Email != "student@example.com" {
		t.Fatalf("Login did not persist provider email correctly: %+v", repo.upserted)
	}
}

func TestServiceLoginEncryptsClonePasswordWhenSecretIsConfigured(t *testing.T) {
	repo := newStubRepository()
	service := NewService(repo, stubTokens{}, stubAuthenticator{
		identity: ExternalIdentity{
			Email:       "student@example.com",
			Username:    "student-user",
			RemoteToken: "remote-jwt",
		},
	}, nil, WithTomorrowCredentialSecret("jwt-secret"))

	_, err := service.Login(context.Background(), LoginRequest{
		Credential: "student-user",
		Password:   "correct-password",
	})
	if err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if len(repo.upserted) != 1 {
		t.Fatalf("upserted users = %d, want 1", len(repo.upserted))
	}
	if repo.upserted[0].LoginCredential != "student-user" {
		t.Fatalf("LoginCredential = %q, want student-user", repo.upserted[0].LoginCredential)
	}
	if repo.upserted[0].LoginPassword == "" || repo.upserted[0].LoginPassword == "correct-password" {
		t.Fatalf("LoginPassword should be encrypted: %+v", repo.upserted[0])
	}
}
