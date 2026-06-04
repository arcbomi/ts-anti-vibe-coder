// Package gitlabclient hides raw GitLab API access behind a reusable bot-token client.
package gitlabclient

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	gitlab "github.com/xanzy/go-gitlab"
)

// Client wraps GitLab API calls made with the server bot token.
type Client struct {
	baseURL string
	token   string
	gl      *gitlab.Client
	initErr error
	ignore  IgnoreRules
}

// New creates a bot-token GitLab client for GitLab.com or a self-hosted GitLab base URL.
func New(baseURL string, token string) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://gitlab.com"
	}
	client := &Client{baseURL: strings.TrimRight(baseURL, "/"), token: token, ignore: DefaultIgnoreRules()}
	if strings.TrimSpace(token) == "" {
		client.initErr = errors.New("gitlab bot token is required")
		return client
	}
	gl, err := gitlab.NewClient(token, gitlab.WithBaseURL(client.baseURL))
	if err != nil {
		client.initErr = err
		return client
	}
	client.gl = gl
	return client
}

// Repository contains basic GitLab project metadata.
type Repository struct {
	ID                int    `json:"id"`
	Name              string `json:"name"`
	PathWithNamespace string `json:"path_with_namespace"`
	DefaultBranch     string `json:"default_branch"`
	WebURL            string `json:"web_url"`
}

// TreeNode contains a sanitized repository tree entry.
type TreeNode struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	Path string `json:"path"`
	Mode string `json:"mode"`
}

func (c *Client) CheckAccess(ctx context.Context, repoURL string) (bool, error) {
	_, err := c.GetRepository(ctx, repoURL)
	if err == nil {
		return true, nil
	}
	if isNotFoundOrForbidden(err) {
		return false, nil
	}
	return false, err
}

func (c *Client) GetRepository(ctx context.Context, repoURL string) (Repository, error) {
	if err := c.ready(); err != nil {
		return Repository{}, err
	}
	projectPath, err := c.projectPath(repoURL)
	if err != nil {
		return Repository{}, err
	}
	project, _, err := c.gl.Projects.GetProject(projectPath, &gitlab.GetProjectOptions{}, gitlab.WithContext(ctx))
	if err != nil {
		return Repository{}, err
	}
	return Repository{
		ID:                project.ID,
		Name:              project.Name,
		PathWithNamespace: project.PathWithNamespace,
		DefaultBranch:     project.DefaultBranch,
		WebURL:            project.WebURL,
	}, nil
}

func (c *Client) GetRepositoryTree(ctx context.Context, repoURL string, branch string) ([]TreeNode, error) {
	if err := c.ready(); err != nil {
		return nil, err
	}
	projectPath, err := c.projectPath(repoURL)
	if err != nil {
		return nil, err
	}
	if branch == "" {
		branch = "main"
	}
	recursive := true
	perPage := 100
	options := &gitlab.ListTreeOptions{Ref: &branch, Recursive: &recursive, ListOptions: gitlab.ListOptions{PerPage: perPage}}
	var result []TreeNode
	for {
		tree, resp, err := c.gl.Repositories.ListTree(projectPath, options, gitlab.WithContext(ctx))
		if err != nil {
			return nil, err
		}
		for _, node := range tree {
			if c.ignore.ShouldIgnore(node.Path) {
				continue
			}
			result = append(result, TreeNode{ID: node.ID, Name: node.Name, Type: node.Type, Path: node.Path, Mode: node.Mode})
		}
		if resp == nil || resp.NextPage == 0 {
			break
		}
		options.Page = resp.NextPage
	}
	return result, nil
}

func (c *Client) GetFileContent(ctx context.Context, repoURL string, filePath string, branch string) ([]byte, error) {
	if err := c.ready(); err != nil {
		return nil, err
	}
	if c.ignore.ShouldIgnore(filePath) {
		return nil, fmt.Errorf("file is ignored by safety rules: %s", filePath)
	}
	projectPath, err := c.projectPath(repoURL)
	if err != nil {
		return nil, err
	}
	if branch == "" {
		branch = "main"
	}
	content, _, err := c.gl.RepositoryFiles.GetRawFile(projectPath, filePath, &gitlab.GetRawFileOptions{Ref: &branch}, gitlab.WithContext(ctx))
	return content, err
}

func (c *Client) ready() error {
	if c == nil {
		return errors.New("gitlab client is nil")
	}
	if c.initErr != nil {
		return c.initErr
	}
	if c.gl == nil {
		return errors.New("gitlab client is not initialized")
	}
	return nil
}

func (c *Client) projectPath(repoURL string) (string, error) {
	baseURL, projectPath, err := ParseRepoURL(repoURL)
	if err != nil {
		return "", err
	}
	if c.baseURL != "" && !strings.EqualFold(strings.TrimRight(baseURL, "/"), c.baseURL) {
		// The configured bot client still hides API details; callers get a clear URL mismatch.
		return "", fmt.Errorf("repository host %s does not match configured GitLab host %s", baseURL, c.baseURL)
	}
	return projectPath, nil
}

// ParseRepoURL parses URLs like https://gitlab.com/group/subgroup/project.
func ParseRepoURL(raw string) (baseURL string, projectPath string, err error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", "", err
	}
	if u.Scheme == "" {
		u.Scheme = "https"
	}
	if u.Host == "" {
		return "", "", errors.New("repository URL host is required")
	}
	baseURL = u.Scheme + "://" + u.Host
	projectPath = strings.Trim(strings.TrimPrefix(u.Path, "/"), "/")
	projectPath = strings.TrimSuffix(projectPath, ".git")
	projectPath = path.Clean(projectPath)
	projectPath = strings.TrimPrefix(projectPath, ".")
	projectPath = strings.TrimPrefix(projectPath, "/")
	if projectPath == "" || projectPath == "." {
		return "", "", errors.New("invalid project path")
	}
	return baseURL, projectPath, nil
}

// IgnoreRules defines files and folders that must not be read by SDK clients.
type IgnoreRules struct {
	Prefixes []string
	Exact    map[string]struct{}
	Suffixes []string
}

func DefaultIgnoreRules() IgnoreRules {
	return IgnoreRules{
		Prefixes: []string{".git/", "node_modules/", "vendor/", "dist/", "build/", "coverage/", ".cache/"},
		Exact:    map[string]struct{}{".env": {}},
		Suffixes: []string{".pem", ".key"},
	}
}

func (r IgnoreRules) ShouldIgnore(filePath string) bool {
	p := strings.TrimPrefix(filePath, "/")
	if _, ok := r.Exact[p]; ok {
		return true
	}
	if p == ".env" || strings.HasSuffix(p, "/.env") {
		return true
	}
	if p == "id_rsa" || strings.HasSuffix(p, "/id_rsa") {
		return true
	}
	for _, pre := range r.Prefixes {
		if strings.HasPrefix(p, pre) || strings.Contains(p, "/"+pre) {
			return true
		}
	}
	for _, suf := range r.Suffixes {
		if strings.HasSuffix(p, suf) {
			return true
		}
	}
	return false
}

func isNotFoundOrForbidden(err error) bool {
	var gitlabErr *gitlab.ErrorResponse
	if errors.As(err, &gitlabErr) && gitlabErr.Response != nil {
		return gitlabErr.Response.StatusCode == http.StatusNotFound || gitlabErr.Response.StatusCode == http.StatusForbidden
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "404") || strings.Contains(msg, "403") || strings.Contains(msg, "not found") || strings.Contains(msg, "forbidden")
}
