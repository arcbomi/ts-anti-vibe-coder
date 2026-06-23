package tomorrow

import (
	"context"
	"fmt"
	"os"
	"strings"
)

type ServiceConfig struct {
	BaseURL  string
	Username string
	Password string
}

type Service struct {
	client   TomorrowClient
	baseURL  string
	username string
	password string
}

func NewService(client TomorrowClient, cfg ServiceConfig) (*Service, error) {
	if client == nil {
		return nil, fmt.Errorf("%w: tomorrow client is required", ErrMissingConfiguration)
	}
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("%w: TOMORROW_BASE_URL", ErrMissingConfiguration)
	}
	password := strings.TrimSpace(cfg.Password)
	if password == "" {
		return nil, fmt.Errorf("%w: TOMORROW_PASSWORD", ErrMissingConfiguration)
	}
	username := firstNonEmpty(cfg.Username, DefaultUsername)
	return &Service{
		client:   client,
		baseURL:  baseURL,
		username: username,
		password: password,
	}, nil
}

func NewServiceFromEnv(client TomorrowClient) (*Service, error) {
	return NewService(client, ServiceConfig{
		BaseURL:  os.Getenv("TOMORROW_BASE_URL"),
		Username: DefaultUsername,
		Password: os.Getenv("TOMORROW_PASSWORD"),
	})
}

func (s *Service) DiscoverSucceededProjects(ctx context.Context, profileURL string) ([]Project, error) {
	session, err := s.client.Login(ctx, s.username, s.password)
	if err != nil {
		return nil, err
	}

	if client, ok := s.client.(SucceededProjectClient); ok {
		return client.FetchSucceededProjects(ctx, session, s.username)
	}

	profileHTML, err := s.client.FetchProfilePage(ctx, session, profileURL)
	if err != nil {
		return nil, err
	}

	projects, err := ParseProjects(profileHTML, s.baseURL, s.username)
	if err != nil {
		return nil, err
	}

	succeeded := make([]Project, 0, len(projects))
	for _, project := range projects {
		if project.IsSucceeded {
			succeeded = append(succeeded, project)
		}
	}
	return succeeded, nil
}
