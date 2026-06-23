package exam

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"backend/pkg/sdk/secretbox"
)

type RepoDownloader interface {
	Download(ctx context.Context, req DownloadRepoRequest) (*DownloadedRepo, error)
}

type DownloadRepoRequest struct {
	UserID      string `json:"user_id"`
	ProjectSlug string `json:"project_slug"`
	RepoURL     string `json:"repo_url"`
	AttemptID   string `json:"attempt_id"`
}

type DownloadedRepo struct {
	LocalPath    string    `json:"local_path"`
	CommitHash   string    `json:"commit_hash"`
	DownloadedAt time.Time `json:"downloaded_at"`
}

type commandExecutor func(ctx context.Context, dir string, name string, args ...string) ([]byte, error)

type GitDownloadService struct {
	storageRoot   string
	connections   tomorrowConnectionStore
	credentialBox *secretbox.Cipher
	cloneTimeout  time.Duration
	exec          commandExecutor
	log           *slog.Logger
	now           func() time.Time
}

type tomorrowConnectionStore interface {
	GetTomorrowConnection(ctx context.Context, userID string) (TomorrowConnection, error)
}

func NewGitDownloadService(storageRoot string, connections tomorrowConnectionStore, credentialBox *secretbox.Cipher, cloneTimeout time.Duration, log *slog.Logger) *GitDownloadService {
	if cloneTimeout <= 0 {
		cloneTimeout = time.Minute
	}
	if log == nil {
		log = slog.Default()
	}
	return &GitDownloadService{
		storageRoot:   strings.TrimSpace(storageRoot),
		connections:   connections,
		credentialBox: credentialBox,
		cloneTimeout:  cloneTimeout,
		exec:          defaultCommandExecutor,
		log:           log,
		now:           func() time.Time { return time.Now().UTC() },
	}
}

func (s *GitDownloadService) Download(ctx context.Context, req DownloadRepoRequest) (*DownloadedRepo, error) {
	if err := validateDownloadRepoRequest(req); err != nil {
		return nil, err
	}
	if s.connections == nil || s.credentialBox == nil {
		return nil, fmt.Errorf("tomorrow school git credential source is required")
	}
	if strings.TrimSpace(s.storageRoot) == "" {
		return nil, fmt.Errorf("repo storage root is required")
	}
	connection, err := s.connections.GetTomorrowConnection(ctx, req.UserID)
	if err != nil {
		return nil, fmt.Errorf("load tomorrow credentials: %w", err)
	}
	loginCredential := strings.TrimSpace(connection.LoginCredential)
	if loginCredential == "" || strings.TrimSpace(connection.LoginPassword) == "" {
		return nil, fmt.Errorf("tomorrow school git credentials are required")
	}
	password, err := s.credentialBox.Decrypt(connection.LoginPassword)
	if err != nil {
		return nil, fmt.Errorf("decrypt tomorrow credentials: %w", err)
	}

	projectSlug := sanitizeProjectSlug(req.ProjectSlug)
	userSegment := sanitizePathSegment(req.UserID)
	attemptSegment := sanitizePathSegment(req.AttemptID)
	localPath := filepath.Join(s.storageRoot, userSegment, projectSlug, attemptSegment, "source")
	parentDir := filepath.Dir(localPath)
	if err := os.MkdirAll(parentDir, 0o755); err != nil {
		return nil, fmt.Errorf("create repo storage directory: %w", err)
	}
	if err := os.RemoveAll(localPath); err != nil {
		return nil, fmt.Errorf("reset repo storage directory: %w", err)
	}

	cloneURL, redactedURL, err := injectGitCredentials(req.RepoURL, loginCredential, password)
	if err != nil {
		return nil, err
	}

	cloneCtx, cancel := context.WithTimeout(ctx, s.cloneTimeout)
	defer cancel()
	s.log.Info("cloning repository", "repo_url", redactedURL, "local_path", localPath)
	if _, err := s.exec(cloneCtx, "", "git", "clone", "--depth", "1", "--no-tags", cloneURL, localPath); err != nil {
		return nil, fmt.Errorf("git clone failed for %s: %w", redactedURL, err)
	}
	commitHash, err := s.exec(ctx, localPath, "git", "rev-parse", "HEAD")
	if err != nil {
		return nil, fmt.Errorf("read cloned commit hash: %w", err)
	}
	return &DownloadedRepo{
		LocalPath:    localPath,
		CommitHash:   strings.TrimSpace(string(commitHash)),
		DownloadedAt: s.now(),
	}, nil
}

func defaultCommandExecutor(ctx context.Context, dir string, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	if dir != "" {
		cmd.Dir = dir
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = strings.TrimSpace(string(out))
		}
		if ctx.Err() != nil {
			return nil, fmt.Errorf("%w", ctx.Err())
		}
		if msg == "" {
			return nil, err
		}
		return nil, fmt.Errorf("%s", msg)
	}
	return out, nil
}

func validateDownloadRepoRequest(req DownloadRepoRequest) error {
	if err := validateUUID(req.UserID, "user_id"); err != nil {
		return appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	if err := validateUUID(req.AttemptID, "attempt_id"); err != nil {
		return appError(ErrCodeBadRequest, err.Error(), http.StatusBadRequest, err)
	}
	if strings.TrimSpace(req.ProjectSlug) == "" {
		return appError(ErrCodeBadRequest, "project_slug is required", http.StatusBadRequest, nil)
	}
	parsed, err := url.Parse(strings.TrimSpace(req.RepoURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return appError(ErrCodeBadRequest, "repo_url must be an absolute git repository URL", http.StatusBadRequest, err)
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return appError(ErrCodeBadRequest, "repo_url must use http or https", http.StatusBadRequest, nil)
	}
	return nil
}

var nonSlugChars = regexp.MustCompile(`[^a-z0-9_-]+`)

func sanitizeProjectSlug(slug string) string {
	slug = strings.ToLower(strings.TrimSpace(slug))
	slug = nonSlugChars.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-_")
	if slug == "" {
		return "project"
	}
	return slug
}

func sanitizePathSegment(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, string(filepath.Separator), "-")
	value = strings.ReplaceAll(value, "..", "-")
	if value == "" {
		return "unknown"
	}
	return value
}

func injectGitCredentials(rawURL, username, password string) (cloneURL string, redactedURL string, err error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", "", fmt.Errorf("parse repo url: %w", err)
	}
	if strings.TrimSpace(username) == "" || password == "" {
		return "", "", fmt.Errorf("git credentials are required")
	}
	parsed.User = url.UserPassword(username, password)
	cloneURL = parsed.String()
	redacted := *parsed
	redacted.User = url.UserPassword(username, "REDACTED")
	return cloneURL, redacted.String(), nil
}
