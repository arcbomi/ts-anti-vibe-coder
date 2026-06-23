package tomorrow

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type HTTPClientConfig struct {
	BaseURL      string
	AuthEndpoint string
	Referrer     string
	XJWTToken    string
	SessionID    string
	Timeout      time.Duration
	HTTPClient   *http.Client
}

type HTTPClient struct {
	baseURL      string
	authEndpoint string
	referrer     string
	xJWTToken    string
	sessionID    string
	httpClient   *http.Client
}

type signInResponse struct {
	Error       string `json:"error"`
	JWT         string `json:"jwt"`
	Token       string `json:"token"`
	AccessToken string `json:"access_token"`
}

type graphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}

type graphQLResponse struct {
	Data struct {
		Progress []struct {
			Grade  float64 `json:"grade"`
			Path   string  `json:"path"`
			Object struct {
				Name string `json:"name"`
				Type string `json:"type"`
			} `json:"object"`
		} `json:"progress"`
		Groups []struct {
			Path         string `json:"path"`
			CaptainLogin string `json:"captainLogin"`
			Members      []struct {
				UserID   int   `json:"userId"`
				Accepted *bool `json:"accepted"`
			} `json:"members"`
			Event struct {
				Path string `json:"path"`
			} `json:"event"`
		} `json:"groups"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

const succeededProjectsQuery = `
query SucceededProjects($userId: Int!, $eventId: Int!) {
  progress(where: {userId: {_eq: $userId}, isDone: {_eq: true}}) {
    grade
    path
    object {
      name
      type
    }
  }
  groups: group(
    where: {
      members: {userId: {_eq: $userId}}
      _or: [
        {eventId: {_eq: $eventId}}
        {event: {parentId: {_eq: $eventId}}}
      ]
    }
    order_by: {updatedAt: desc}
  ) {
    path
    captainLogin
    members(where: {userId: {_eq: $userId}}) {
      userId
      accepted
    }
    event {
      path
    }
  }
}`

func NewHTTPClient(cfg HTTPClientConfig) (*HTTPClient, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("%w: TOMORROW_BASE_URL", ErrMissingConfiguration)
	}
	authEndpoint := strings.TrimSpace(cfg.AuthEndpoint)
	if authEndpoint == "" {
		authEndpoint = baseURL + "/api/auth/signin"
	}
	referrer := strings.TrimSpace(cfg.Referrer)
	if referrer == "" {
		referrer = baseURL + "/?show-password=1"
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		timeout := cfg.Timeout
		if timeout <= 0 {
			timeout = 15 * time.Second
		}
		httpClient = &http.Client{Timeout: timeout}
	}
	return &HTTPClient{
		baseURL:      baseURL,
		authEndpoint: authEndpoint,
		referrer:     referrer,
		xJWTToken:    firstNonEmpty(strings.TrimSpace(cfg.XJWTToken), "undefined"),
		sessionID:    strings.TrimSpace(cfg.SessionID),
		httpClient:   httpClient,
	}, nil
}

func (c *HTTPClient) Login(ctx context.Context, username, password string) (Session, error) {
	if c == nil {
		return Session{}, fmt.Errorf("%w: client is nil", ErrLoginFailed)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.authEndpoint, http.NoBody)
	if err != nil {
		return Session{}, fmt.Errorf("%w: create request: %v", ErrLoginFailed, err)
	}
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", basicAuthorization(username, password))
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")
	req.Header.Set("X-Jwt-Token", c.xJWTToken)
	if c.sessionID != "" {
		req.Header.Set("X-Session-Id", c.sessionID)
	}
	if c.referrer != "" {
		req.Header.Set("Referer", c.referrer)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Session{}, fmt.Errorf("%w: %v", ErrLoginFailed, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return Session{}, fmt.Errorf("%w: read response: %v", ErrLoginFailed, err)
	}

	token, responseErr := extractAuthToken(body)
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || responseErr == invalidCredentialsErrMsg {
		return Session{}, fmt.Errorf("%w: invalid credentials", ErrLoginFailed)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Session{}, fmt.Errorf("%w: status %d", ErrLoginFailed, resp.StatusCode)
	}
	if token == "" {
		return Session{}, fmt.Errorf("%w: missing jwt in signin response", ErrLoginFailed)
	}

	return Session{
		JWT:     token,
		Cookies: resp.Cookies(),
	}, nil
}

func (c *HTTPClient) FetchProfilePage(ctx context.Context, session Session, profileURL string) (string, error) {
	if c == nil {
		return "", fmt.Errorf("%w: client is nil", ErrProfileFetchFailed)
	}
	targetURL, err := c.resolveProfileURL(profileURL)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrProfileFetchFailed, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, http.NoBody)
	if err != nil {
		return "", fmt.Errorf("%w: create request: %v", ErrProfileFetchFailed, err)
	}
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(session.JWT))
	req.Header.Set("Referer", c.baseURL+"/")
	for _, cookie := range session.Cookies {
		req.AddCookie(cookie)
	}
	if len(session.Cookies) == 0 && strings.TrimSpace(session.JWT) != "" {
		req.AddCookie(&http.Cookie{Name: "token", Value: strings.TrimSpace(session.JWT)})
		req.AddCookie(&http.Cookie{Name: "jwt", Value: strings.TrimSpace(session.JWT)})
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrProfileFetchFailed, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	if err != nil {
		return "", fmt.Errorf("%w: read response: %v", ErrProfileFetchFailed, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("%w: status %d", ErrProfileFetchFailed, resp.StatusCode)
	}

	page := string(body)
	if !strings.Contains(strings.ToLower(page), "<html") {
		return "", fmt.Errorf("%w: expected html document", ErrProfileFetchFailed)
	}
	return page, nil
}

func (c *HTTPClient) FetchSucceededProjects(ctx context.Context, session Session, username string) ([]Project, error) {
	if c == nil {
		return nil, fmt.Errorf("%w: client is nil", ErrProjectDiscovery)
	}
	token := strings.TrimSpace(session.JWT)
	userID, err := userIDFromJWT(token)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProjectDiscovery, err)
	}
	payload, err := json.Marshal(graphQLRequest{
		Query:     succeededProjectsQuery,
		Variables: map[string]any{"userId": userID, "eventId": DefaultEventID},
	})
	if err != nil {
		return nil, fmt.Errorf("%w: encode request: %v", ErrProjectDiscovery, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/graphql-engine/v1/graphql", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("%w: create request: %v", ErrProjectDiscovery, err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProjectDiscovery, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("%w: read response: %v", ErrProjectDiscovery, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%w: status %d", ErrProjectDiscovery, resp.StatusCode)
	}
	var result graphQLResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("%w: decode response: %v", ErrProjectDiscovery, err)
	}
	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("%w: %s", ErrProjectDiscovery, strings.TrimSpace(result.Errors[0].Message))
	}

	username = firstNonEmpty(username, DefaultUsername)
	type repositoryOwnerChoice struct {
		owner           string
		acceptanceScore int
	}
	repositoryOwners := make(map[string]repositoryOwnerChoice, len(result.Data.Groups)*2)
	for _, group := range result.Data.Groups {
		owner := strings.TrimSpace(group.CaptainLogin)
		if owner == "" {
			continue
		}
		acceptanceScore := 0
		if len(group.Members) > 0 && group.Members[0].Accepted != nil {
			acceptanceScore = 1
			if *group.Members[0].Accepted {
				acceptanceScore = 2
			}
		}
		for _, groupPath := range []string{group.Path, group.Event.Path} {
			if normalizedPath := normalizeProjectPath(groupPath); normalizedPath != "" {
				current, alreadyResolved := repositoryOwners[normalizedPath]
				if !alreadyResolved || acceptanceScore > current.acceptanceScore {
					repositoryOwners[normalizedPath] = repositoryOwnerChoice{
						owner:           owner,
						acceptanceScore: acceptanceScore,
					}
				}
			}
		}
	}
	projects := make([]Project, 0, len(result.Data.Progress))
	seen := make(map[string]struct{}, len(result.Data.Progress))
	for _, progress := range result.Data.Progress {
		if !strings.EqualFold(strings.TrimSpace(progress.Object.Type), "project") {
			continue
		}
		name := strings.TrimSpace(progress.Object.Name)
		slug := slugify(name)
		if slug == "" {
			slug = slugify(pathBase(progress.Path))
		}
		if slug == "" {
			continue
		}
		if _, exists := seen[slug]; exists {
			continue
		}
		seen[slug] = struct{}{}
		repositoryOwner := username
		if groupOwner := repositoryOwners[normalizeProjectPath(progress.Path)].owner; groupOwner != "" {
			repositoryOwner = groupOwner
		}
		projects = append(projects, Project{
			ID:          slug,
			Slug:        slug,
			Name:        firstNonEmpty(name, slug),
			RepoURL:     fmt.Sprintf("%s/git/%s/%s", c.baseURL, repositoryOwner, slug),
			Status:      succeededStatusText,
			IsSucceeded: true,
		})
	}
	return projects, nil
}

func normalizeProjectPath(value string) string {
	return strings.Trim(strings.TrimSpace(value), "/")
}

func userIDFromJWT(token string) (int, error) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) < 2 {
		return 0, fmt.Errorf("invalid jwt")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return 0, fmt.Errorf("decode jwt claims: %w", err)
	}
	var claims map[string]any
	if err := json.Unmarshal(payload, &claims); err != nil {
		return 0, fmt.Errorf("decode jwt claims: %w", err)
	}
	for _, value := range []any{
		claims["sub"],
		nestedClaim(claims, "https://hasura.io/jwt/claims", "x-hasura-user-id"),
	} {
		switch typed := value.(type) {
		case string:
			var userID int
			if _, err := fmt.Sscanf(strings.TrimSpace(typed), "%d", &userID); err == nil && userID > 0 {
				return userID, nil
			}
		case float64:
			if typed > 0 {
				return int(typed), nil
			}
		}
	}
	return 0, fmt.Errorf("jwt does not contain a user id")
}

func nestedClaim(claims map[string]any, objectKey, valueKey string) any {
	nested, _ := claims[objectKey].(map[string]any)
	return nested[valueKey]
}

func pathBase(value string) string {
	trimmed := strings.Trim(strings.TrimSpace(value), "/")
	if trimmed == "" {
		return ""
	}
	parts := strings.Split(trimmed, "/")
	return parts[len(parts)-1]
}

func (c *HTTPClient) resolveProfileURL(profileURL string) (string, error) {
	profileURL = strings.TrimSpace(profileURL)
	if profileURL == "" {
		profileURL = DefaultProfilePath
	}
	parsed, err := url.Parse(profileURL)
	if err != nil {
		return "", fmt.Errorf("invalid profile url %q: %w", profileURL, err)
	}
	if parsed.IsAbs() {
		return parsed.String(), nil
	}
	baseParsed, err := url.Parse(c.baseURL)
	if err != nil {
		return "", fmt.Errorf("invalid base url %q: %w", c.baseURL, err)
	}
	return baseParsed.ResolveReference(parsed).String(), nil
}

func extractAuthToken(raw []byte) (token string, responseErr string) {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return "", ""
	}

	if strings.HasPrefix(trimmed, "\"") && strings.HasSuffix(trimmed, "\"") {
		if err := json.Unmarshal([]byte(trimmed), &token); err == nil {
			return strings.TrimSpace(token), ""
		}
	}

	var payload signInResponse
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", ""
	}
	return firstNonEmpty(strings.TrimSpace(payload.JWT), strings.TrimSpace(payload.AccessToken), strings.TrimSpace(payload.Token)), strings.TrimSpace(payload.Error)
}

func basicAuthorization(username, password string) string {
	encoded := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	return "Basic " + encoded
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
