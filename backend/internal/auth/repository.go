package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Repository stores and loads authentication users.
type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureSchema(ctx context.Context) error {
	if r == nil || r.db == nil {
		return fmt.Errorf("auth repository database is nil")
	}

	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			first_name TEXT NOT NULL DEFAULT '',
			last_name TEXT NOT NULL DEFAULT '',
			username TEXT NOT NULL DEFAULT '',
			tomorrow_login_credential TEXT NOT NULL DEFAULT '',
			tomorrow_login_password TEXT NOT NULL DEFAULT '',
			password_hash TEXT NOT NULL,
			auth_provider TEXT NOT NULL DEFAULT 'local',
			tomorrow_remote_token TEXT NOT NULL DEFAULT '',
			tomorrow_profile_path TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_login_credential TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_login_password TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_remote_token TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS tomorrow_profile_path TEXT NOT NULL DEFAULT ''`,
	}
	for _, stmt := range statements {
		if _, err := r.db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) CreateUser(ctx context.Context, user User) (User, error) {
	if r == nil || r.db == nil {
		return User{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
INSERT INTO users (id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path, created_at, updated_at`
	created, err := scanUser(r.db.QueryRowContext(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.FirstName,
		user.LastName,
		user.Username,
		user.LoginCredential,
		user.LoginPassword,
		user.PasswordHash,
		user.AuthProvider,
		user.RemoteToken,
		user.ProfilePath,
	))
	if err != nil {
		return User{}, err
	}
	return created, nil
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (User, error) {
	if r == nil || r.db == nil {
		return User{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
SELECT id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path, created_at, updated_at
FROM users
WHERE email = $1`
	user, err := scanUser(r.db.QueryRowContext(ctx, query, email))
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return user, err
}

func (r *Repository) GetUserByID(ctx context.Context, id string) (User, error) {
	if r == nil || r.db == nil {
		return User{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
SELECT id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path, created_at, updated_at
FROM users
WHERE id = $1`
	user, err := scanUser(r.db.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return user, err
}

func (r *Repository) UpdateUserForDevSeed(ctx context.Context, user User) (User, error) {
	if r == nil || r.db == nil {
		return User{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
UPDATE users
SET name = $2, first_name = $3, last_name = $4, username = $5, tomorrow_login_credential = $6, tomorrow_login_password = $7, password_hash = $8, auth_provider = $9, tomorrow_remote_token = $10, tomorrow_profile_path = $11, updated_at = now()
WHERE email = $1
RETURNING id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path, created_at, updated_at`
	updated, err := scanUser(r.db.QueryRowContext(ctx, query,
		user.Email,
		user.Name,
		user.FirstName,
		user.LastName,
		user.Username,
		user.LoginCredential,
		user.LoginPassword,
		user.PasswordHash,
		user.AuthProvider,
		user.RemoteToken,
		user.ProfilePath,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return updated, err
}

func (r *Repository) UpsertExternalUser(ctx context.Context, user User) (User, error) {
	if r == nil || r.db == nil {
		return User{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
INSERT INTO users (id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
	first_name = EXCLUDED.first_name,
	last_name = EXCLUDED.last_name,
	username = EXCLUDED.username,
	tomorrow_login_credential = EXCLUDED.tomorrow_login_credential,
	tomorrow_login_password = EXCLUDED.tomorrow_login_password,
	auth_provider = EXCLUDED.auth_provider,
	tomorrow_remote_token = EXCLUDED.tomorrow_remote_token,
	tomorrow_profile_path = EXCLUDED.tomorrow_profile_path,
	updated_at = now()
RETURNING id, email, name, first_name, last_name, username, tomorrow_login_credential, tomorrow_login_password, password_hash, auth_provider, tomorrow_remote_token, tomorrow_profile_path, created_at, updated_at`
	upserted, err := scanUser(r.db.QueryRowContext(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.FirstName,
		user.LastName,
		user.Username,
		user.LoginCredential,
		user.LoginPassword,
		user.PasswordHash,
		user.AuthProvider,
		user.RemoteToken,
		user.ProfilePath,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return upserted, err
}

func (r *Repository) GetTomorrowConnection(ctx context.Context, userID string) (TomorrowConnection, error) {
	if r == nil || r.db == nil {
		return TomorrowConnection{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
SELECT username, tomorrow_remote_token, tomorrow_profile_path, tomorrow_login_credential, tomorrow_login_password
FROM users
WHERE id = $1`

	var connection TomorrowConnection
	if err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&connection.Username,
		&connection.RemoteToken,
		&connection.ProfilePath,
		&connection.LoginCredential,
		&connection.LoginPassword,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TomorrowConnection{}, ErrUserNotFound
		}
		return TomorrowConnection{}, err
	}
	return connection, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanUser(row rowScanner) (User, error) {
	var user User
	if err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.FirstName,
		&user.LastName,
		&user.Username,
		&user.LoginCredential,
		&user.LoginPassword,
		&user.PasswordHash,
		&user.AuthProvider,
		&user.RemoteToken,
		&user.ProfilePath,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		return User{}, err
	}
	return user, nil
}
