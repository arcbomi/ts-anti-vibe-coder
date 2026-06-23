package worker

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
)

type AnalysisJobMessage struct {
	JobID        string `json:"job_id"`
	UserID       string `json:"user_id"`
	RepositoryID string `json:"repository_id"`
	GiteaRepoURL string `json:"gitea_repo_url"`
	Branch       string `json:"branch"`
	Attempt      int    `json:"attempt"`
}

func (m *AnalysisJobMessage) Validate() error {
	if _, err := uuid.Parse(strings.TrimSpace(m.JobID)); err != nil {
		return NewPermanentError(ErrCodeUnknown, fmt.Sprintf("job_id must be a uuid: %v", err), err)
	}
	if _, err := uuid.Parse(strings.TrimSpace(m.UserID)); err != nil {
		return NewPermanentError(ErrCodeUnknown, fmt.Sprintf("user_id must be a uuid: %v", err), err)
	}
	if _, err := uuid.Parse(strings.TrimSpace(m.RepositoryID)); err != nil {
		return NewPermanentError(ErrCodeUnknown, fmt.Sprintf("repository_id must be a uuid: %v", err), err)
	}
	parsed, err := url.Parse(strings.TrimSpace(m.GiteaRepoURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return NewPermanentError(ErrCodeInvalidRepositoryURL, "gitea_repo_url must be an absolute Gitea repository URL", err)
	}
	if strings.Trim(parsed.Path, "/") == "" {
		return NewPermanentError(ErrCodeInvalidRepositoryURL, "gitea_repo_url must include a project path", nil)
	}
	if strings.TrimSpace(m.Branch) == "" {
		m.Branch = "main"
	}
	if m.Attempt <= 0 {
		m.Attempt = 1
	}
	return nil
}
