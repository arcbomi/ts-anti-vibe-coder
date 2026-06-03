package gitlabclient

import (
  "context"
  "errors"
  "net/url"
  "path"
  "strings"

  gitlab "github.com/xanzy/go-gitlab"
)

type Client struct {
  gl *gitlab.Client
}

type Options struct {
  BaseURL string
  Token   string
}

func New(opts Options) (*Client, error) {
  if strings.TrimSpace(opts.Token) == "" {
    return nil, errors.New("gitlab bot token is required")
  }
  if strings.TrimSpace(opts.BaseURL) == "" {
    opts.BaseURL = "https://gitlab.com"
  }

  gl, err := gitlab.NewClient(opts.Token, gitlab.WithBaseURL(strings.TrimRight(opts.BaseURL, "/")))
  if err != nil {
    return nil, err
  }
  return &Client{gl: gl}, nil
}

// ParseRepoURL parses URLs like:
// - https://gitlab.com/group/project
// - https://gitlab.com/group/subgroup/project
func ParseRepoURL(raw string) (baseURL string, projectPath string, err error) {
  u, err := url.Parse(strings.TrimSpace(raw))
  if err != nil {
    return "", "", err
  }
  if u.Scheme == "" {
    u.Scheme = "https"
  }
  baseURL = u.Scheme + "://" + u.Host
  projectPath = strings.Trim(strings.TrimPrefix(u.Path, "/"), "/")
  projectPath = path.Clean(projectPath)
  projectPath = strings.TrimPrefix(projectPath, ".")
  projectPath = strings.TrimPrefix(projectPath, "/")
  if projectPath == "" || projectPath == "." {
    return "", "", errors.New("invalid project path")
  }
  return baseURL, projectPath, nil
}

func (c *Client) CheckBotAccess(ctx context.Context, projectPath string) error {
  _, _, err := c.gl.Projects.GetProject(projectPath, &gitlab.GetProjectOptions{}, gitlab.WithContext(ctx))
  return err
}

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
  if p == "id_rsa" || strings.HasSuffix(p, "/id_rsa") {
    return true
  }
  for _, pre := range r.Prefixes {
    if strings.HasPrefix(p, pre) {
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
