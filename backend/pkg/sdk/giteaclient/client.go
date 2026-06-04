package giteaclient

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

var ErrTomorrowSchoolJWTUnsupported = errors.New("tomorrow school jwt cannot be exchanged directly for a gitea session cookie")

type Repository struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
	HTMLURL       string `json:"html_url"`
	CloneURL      string `json:"clone_url"`
}

type TreeNode struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	Path string `json:"path"`
	Mode string `json:"mode"`
}

type IgnoreRules struct {
	Prefixes []string
	Exact    map[string]struct{}
	Suffixes []string
}

type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
	ignore     IgnoreRules
}

func New(baseURL string, token string) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://01.tomorrow-school.ai/git"
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   strings.TrimSpace(token),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		ignore: DefaultIgnoreRules(),
	}
}

func (c *Client) OAuthLoginURL() string {
	if c == nil || c.baseURL == "" {
		return "/user/oauth2/01-platform"
	}
	return c.baseURL + "/user/oauth2/01-platform"
}

func (c *Client) SessionCookiesFromTomorrowSchoolJWT(context.Context, string) ([]*http.Cookie, error) {
	return nil, ErrTomorrowSchoolJWTUnsupported
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
	owner, repo, err := c.repoParts(repoURL)
	if err != nil {
		return Repository{}, err
	}

	var payload struct {
		ID            int    `json:"id"`
		Name          string `json:"name"`
		FullName      string `json:"full_name"`
		DefaultBranch string `json:"default_branch"`
		Private       bool   `json:"private"`
		HTMLURL       string `json:"html_url"`
		CloneURL      string `json:"clone_url"`
	}
	if err := c.getJSON(ctx, c.apiURL("/repos/"+url.PathEscape(owner)+"/"+url.PathEscape(repo)), &payload); err != nil {
		return Repository{}, err
	}

	htmlURL := firstNonEmpty(payload.HTMLURL, normalizeRepositoryURL(c.baseURL, payload.FullName))
	return Repository{
		ID:            payload.ID,
		Name:          payload.Name,
		FullName:      payload.FullName,
		DefaultBranch: payload.DefaultBranch,
		Private:       payload.Private,
		HTMLURL:       htmlURL,
		CloneURL:      firstNonEmpty(payload.CloneURL, htmlURL+".git"),
	}, nil
}

func (c *Client) GetRepositoryTree(ctx context.Context, repoURL string, branch string) ([]TreeNode, error) {
	owner, repo, err := c.repoParts(repoURL)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(branch) == "" {
		branch = "main"
	}

	treeURL := c.apiURL("/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/git/trees/" + url.PathEscape(branch) + "?recursive=true")
	var payload struct {
		Tree []struct {
			Path string `json:"path"`
			Mode string `json:"mode"`
			Type string `json:"type"`
			SHA  string `json:"sha"`
			URL  string `json:"url"`
		} `json:"tree"`
	}
	if err := c.getJSON(ctx, treeURL, &payload); err != nil {
		return nil, err
	}

	nodes := make([]TreeNode, 0, len(payload.Tree))
	for _, node := range payload.Tree {
		if c.ignore.ShouldIgnore(node.Path) {
			continue
		}
		nodeType := node.Type
		switch nodeType {
		case "blob", "tree":
		default:
			if nodeType == "" {
				nodeType = inferNodeType(node.Mode)
			}
		}
		nodes = append(nodes, TreeNode{
			ID:   node.SHA,
			Name: path.Base(node.Path),
			Type: nodeType,
			Path: node.Path,
			Mode: node.Mode,
		})
	}
	return nodes, nil
}

func (c *Client) GetFileContent(ctx context.Context, repoURL string, filePath string, branch string) ([]byte, error) {
	owner, repo, err := c.repoParts(repoURL)
	if err != nil {
		return nil, err
	}
	if c.ignore.ShouldIgnore(filePath) {
		return nil, fmt.Errorf("file is ignored by safety rules: %s", filePath)
	}
	if strings.TrimSpace(branch) == "" {
		branch = "main"
	}

	contentURL := c.apiURL("/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo) + "/contents/" + escapePathSegments(filePath) + "?ref=" + url.QueryEscape(branch))
	var payload struct {
		Type     string `json:"type"`
		Encoding string `json:"encoding"`
		Content  string `json:"content"`
	}
	if err := c.getJSON(ctx, contentURL, &payload); err != nil {
		return nil, err
	}
	if payload.Type != "" && payload.Type != "file" {
		return nil, fmt.Errorf("repository path is not a file: %s", filePath)
	}
	if !strings.EqualFold(payload.Encoding, "base64") {
		return nil, fmt.Errorf("unsupported file encoding %q", payload.Encoding)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(payload.Content, "\n", ""))
	if err != nil {
		return nil, err
	}
	return decoded, nil
}

func (c *Client) ListMyRepositories(ctx context.Context, cookies []*http.Cookie) ([]Repository, error) {
	if c == nil || strings.TrimSpace(c.baseURL) == "" {
		return nil, fmt.Errorf("gitea base url is required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.apiURL("/user/repos"), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	for _, cookie := range cookies {
		if cookie == nil {
			continue
		}
		req.AddCookie(cookie)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, ErrTomorrowSchoolJWTUnsupported
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("gitea list repositories returned status %d", resp.StatusCode)
	}

	var repositories []Repository
	if err := json.NewDecoder(resp.Body).Decode(&repositories); err != nil {
		return nil, err
	}
	for i := range repositories {
		repositories[i].HTMLURL = firstNonEmpty(repositories[i].HTMLURL, normalizeRepositoryURL(c.baseURL, repositories[i].FullName))
		repositories[i].CloneURL = firstNonEmpty(repositories[i].CloneURL, repositories[i].HTMLURL+".git")
	}
	return repositories, nil
}

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

	rawPath := strings.Trim(strings.TrimSuffix(u.Path, ".git"), "/")
	segments := splitPath(rawPath)
	if len(segments) < 2 {
		return "", "", errors.New("invalid project path")
	}
	projectSegments := segments[len(segments)-2:]
	baseSegments := segments[:len(segments)-2]

	basePath := "/" + strings.Join(baseSegments, "/")
	if len(baseSegments) == 0 {
		basePath = ""
	}
	projectPath = path.Clean(strings.Join(projectSegments, "/"))
	projectPath = strings.Trim(projectPath, "/")
	if projectPath == "" || projectPath == "." {
		return "", "", errors.New("invalid project path")
	}

	base := &url.URL{Scheme: u.Scheme, Host: u.Host, Path: basePath}
	return strings.TrimRight(base.String(), "/"), projectPath, nil
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

func (c *Client) repoParts(repoURL string) (owner string, repo string, err error) {
	if err := c.ready(); err != nil {
		return "", "", err
	}
	baseURL, projectPath, err := ParseRepoURL(repoURL)
	if err != nil {
		return "", "", err
	}
	if !strings.EqualFold(strings.TrimRight(baseURL, "/"), c.baseURL) {
		return "", "", fmt.Errorf("repository host %s does not match configured Gitea host %s", baseURL, c.baseURL)
	}
	parts := splitPath(projectPath)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid Gitea repository path %q", projectPath)
	}
	return parts[0], parts[1], nil
}

func (c *Client) ready() error {
	if c == nil {
		return errors.New("gitea client is nil")
	}
	if strings.TrimSpace(c.baseURL) == "" {
		return errors.New("gitea base url is required")
	}
	if strings.TrimSpace(c.token) == "" {
		return errors.New("gitea bot token is required")
	}
	if c.httpClient == nil {
		return errors.New("gitea http client is nil")
	}
	return nil
}

func (c *Client) getJSON(ctx context.Context, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "token "+c.token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("gitea api %s returned status %d", endpoint, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *Client) apiURL(apiPath string) string {
	return strings.TrimRight(c.baseURL, "/") + "/api/v1" + apiPath
}

func normalizeRepositoryURL(baseURL, fullName string) string {
	u, err := url.Parse(baseURL)
	if err != nil {
		return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(fullName, "/")
	}
	u.Path = strings.TrimRight(u.Path, "/") + "/" + strings.TrimLeft(fullName, "/")
	return u.String()
}

func inferNodeType(mode string) string {
	if strings.HasPrefix(mode, "040") {
		return "tree"
	}
	return "blob"
}

func escapePathSegments(filePath string) string {
	segments := splitPath(filePath)
	escaped := make([]string, 0, len(segments))
	for _, segment := range segments {
		escaped = append(escaped, url.PathEscape(segment))
	}
	return strings.Join(escaped, "/")
}

func splitPath(raw string) []string {
	raw = strings.Trim(raw, "/")
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, "/")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		result = append(result, part)
	}
	return result
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func isNotFoundOrForbidden(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "404") || strings.Contains(msg, "403") || strings.Contains(msg, "not found") || strings.Contains(msg, "forbidden")
}
