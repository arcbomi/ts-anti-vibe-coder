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

func (r *Repository) CreateUser(ctx context.Context, user User) (User, error) {
	if r == nil || r.db == nil {
		return User{}, fmt.Errorf("auth repository database is nil")
	}

	query := `
INSERT INTO users (id, email, name, password_hash, auth_provider)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, name, password_hash, auth_provider, created_at, updated_at`
	created, err := scanUser(r.db.QueryRowContext(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.PasswordHash,
		user.AuthProvider,
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
SELECT id, email, name, password_hash, auth_provider, created_at, updated_at
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
SELECT id, email, name, password_hash, auth_provider, created_at, updated_at
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
SET name = $2, password_hash = $3, updated_at = now()
WHERE email = $1
RETURNING id, email, name, password_hash, auth_provider, created_at, updated_at`
	updated, err := scanUser(r.db.QueryRowContext(ctx, query,
		user.Email,
		user.Name,
		user.PasswordHash,
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
INSERT INTO users (id, email, name, password_hash, auth_provider)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
	auth_provider = EXCLUDED.auth_provider,
	updated_at = now()
RETURNING id, email, name, password_hash, auth_provider, created_at, updated_at`
	upserted, err := scanUser(r.db.QueryRowContext(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.PasswordHash,
		user.AuthProvider,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	return upserted, err
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
		&user.PasswordHash,
		&user.AuthProvider,
		&user.CreatedAt,
		&user.UpdatedAt,
	); err != nil {
		return User{}, err
	}
	return user, nil
}
