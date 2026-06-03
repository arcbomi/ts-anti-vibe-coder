package gitlab

import (
	"fmt"
	"net/url"
	"path"
	"strings"

	"backend/pkg/sdk/gitlabclient"
)

type Validator struct {
	AllowedBaseURL string
}

type NormalizedRepo struct {
	URL         string
	ProjectPath string
	BaseURL     string
}

func NewValidator(allowedBaseURL string) *Validator {
	return &Validator{AllowedBaseURL: strings.TrimRight(strings.TrimSpace(allowedBaseURL), "/")}
}

func (v *Validator) Normalize(raw string) (NormalizedRepo, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return NormalizedRepo{}, fmt.Errorf("repository URL is required")
	}

	baseURL, projectPath, err := gitlabclient.ParseRepoURL(raw)
	if err != nil {
		return NormalizedRepo{}, err
	}
	if v != nil && v.AllowedBaseURL != "" && !strings.EqualFold(strings.TrimRight(baseURL, "/"), v.AllowedBaseURL) {
		return NormalizedRepo{}, fmt.Errorf("unsupported GitLab host")
	}

	u, err := url.Parse(baseURL)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return NormalizedRepo{}, fmt.Errorf("invalid GitLab URL")
	}
	projectPath = strings.Trim(path.Clean(projectPath), "/")
	if projectPath == "." || projectPath == "" || strings.Contains(projectPath, "..") {
		return NormalizedRepo{}, fmt.Errorf("invalid GitLab project path")
	}

	return NormalizedRepo{
		URL:         strings.TrimRight(baseURL, "/") + "/" + projectPath,
		ProjectPath: projectPath,
		BaseURL:     strings.TrimRight(baseURL, "/"),
	}, nil
}
