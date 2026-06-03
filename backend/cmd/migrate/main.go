package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"backend/pkg/sdk/config"
	"backend/pkg/sdk/database"
	"backend/pkg/sdk/logger"
)

func main() {
	command := "up"
	if len(os.Args) > 1 {
		command = strings.TrimSpace(os.Args[1])
	}
	if command != "up" {
		_, _ = fmt.Fprintf(os.Stderr, "unsupported migration command %q; only 'up' is supported\n", command)
		os.Exit(2)
	}

	cfg, err := config.LoadFromEnv("migrate")
	if err != nil {
		panic(err)
	}
	log := logger.New(cfg.ServiceName, cfg.LogLevel)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Error("database connection failed", "err", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close() }()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := runMigrations(ctx, db, migrationsDir()); err != nil {
		log.Error("migration failed", "err", err)
		os.Exit(1)
	}
	log.Info("migrations complete")
}

func migrationsDir() string {
	if dir := strings.TrimSpace(os.Getenv("MIGRATIONS_DIR")); dir != "" {
		return dir
	}
	return "./migrations"
}

func runMigrations(ctx context.Context, db *sql.DB, dir string) error {
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)
	if len(files) == 0 {
		return fmt.Errorf("no migration files found in %s", dir)
	}

	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		return err
	}

	for _, file := range files {
		version := filepath.Base(file)
		applied, err := isApplied(ctx, db, version)
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		contents, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		if err := applyMigration(ctx, db, version, string(contents)); err != nil {
			return err
		}
	}
	return nil
}

func isApplied(ctx context.Context, db *sql.DB, version string) (bool, error) {
	var exists bool
	err := db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists)
	return exists, err
}

func applyMigration(ctx context.Context, db *sql.DB, version string, sqlText string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, sqlText); err != nil {
		return fmt.Errorf("apply %s: %w", version, err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
		return err
	}
	return tx.Commit()
}
