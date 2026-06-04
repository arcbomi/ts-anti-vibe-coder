package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const tomorrowSchoolUserByIDQuery = `
query UserById($userId: Int!) {
  user: user_by_pk(id: $userId) {
    login
    email
    firstName
    lastName
  }
}`

type tomorrowSchoolGraphQLRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables,omitempty"`
}

type tomorrowSchoolGraphQLResponse struct {
	Data struct {
		User *struct {
			Login     string `json:"login"`
			Email     string `json:"email"`
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
		} `json:"user"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (c *TomorrowSchoolClient) fetchProfileOverGraphQL(ctx context.Context, token, subject string) (tomorrowSchoolProfile, error) {
	if c == nil || strings.TrimSpace(c.graphQLEndpoint) == "" {
		return tomorrowSchoolProfile{}, fmt.Errorf("graphql endpoint is not configured")
	}

	userID, err := strconv.Atoi(strings.TrimSpace(subject))
	if err != nil {
		return tomorrowSchoolProfile{}, fmt.Errorf("invalid subject %q: %w", subject, err)
	}

	payload, err := json.Marshal(tomorrowSchoolGraphQLRequest{
		Query: tomorrowSchoolUserByIDQuery,
		Variables: map[string]any{
			"userId": userID,
		},
	})
	if err != nil {
		return tomorrowSchoolProfile{}, fmt.Errorf("marshal graphql request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, graphqlHTTPEndpoint(c.graphQLEndpoint), bytes.NewReader(payload))
	if err != nil {
		return tomorrowSchoolProfile{}, fmt.Errorf("create graphql request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	req.Header.Set("X-Hasura-Role", firstNonEmptyTrimmed(c.graphQLRole, "user"))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return tomorrowSchoolProfile{}, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return tomorrowSchoolProfile{}, fmt.Errorf("read graphql response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return tomorrowSchoolProfile{}, fmt.Errorf("graphql status %d", resp.StatusCode)
	}

	var result tomorrowSchoolGraphQLResponse
	if err := json.Unmarshal(raw, &result); err != nil {
		return tomorrowSchoolProfile{}, fmt.Errorf("decode graphql response: %w", err)
	}
	if len(result.Errors) > 0 {
		return tomorrowSchoolProfile{}, fmt.Errorf("graphql error: %s", strings.TrimSpace(result.Errors[0].Message))
	}
	if result.Data.User == nil {
		return tomorrowSchoolProfile{}, fmt.Errorf("graphql user not found")
	}

	return tomorrowSchoolProfile{
		Email:     strings.TrimSpace(result.Data.User.Email),
		Login:     strings.TrimSpace(result.Data.User.Login),
		FirstName: strings.TrimSpace(result.Data.User.FirstName),
		LastName:  strings.TrimSpace(result.Data.User.LastName),
	}, nil
}

func graphqlHTTPEndpoint(endpoint string) string {
	parsed, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil {
		return strings.TrimSpace(endpoint)
	}
	switch parsed.Scheme {
	case "ws":
		parsed.Scheme = "http"
	case "wss":
		parsed.Scheme = "https"
	}
	return parsed.String()
}
