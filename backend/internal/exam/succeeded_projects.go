package exam

import (
	"context"
	"fmt"
	"strings"

	"backend/internal/tomorrow"
)

type TomorrowConnection struct {
	Username        string
	RemoteToken     string
	ProfilePath     string
	LoginCredential string
	LoginPassword   string
}

type SucceededProjectSource interface {
	ListSucceededProjects(ctx context.Context, connection TomorrowConnection) ([]tomorrow.Project, error)
}

type TomorrowSucceededProjectSource struct {
	client  tomorrow.TomorrowClient
	baseURL string
}

func NewTomorrowSucceededProjectSource(client tomorrow.TomorrowClient, baseURL string) *TomorrowSucceededProjectSource {
	return &TomorrowSucceededProjectSource{
		client:  client,
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
	}
}

func (s *TomorrowSucceededProjectSource) ListSucceededProjects(ctx context.Context, connection TomorrowConnection) ([]tomorrow.Project, error) {
	if s == nil || s.client == nil {
		return nil, fmt.Errorf("tomorrow project source is not configured")
	}
	username := strings.TrimSpace(connection.Username)
	token := strings.TrimSpace(connection.RemoteToken)
	if username == "" || token == "" {
		return nil, fmt.Errorf("tomorrow sync connection is incomplete")
	}

	profilePath := strings.TrimSpace(connection.ProfilePath)
	if profilePath == "" {
		profilePath = tomorrow.DefaultProfilePath
	}

	if client, ok := s.client.(tomorrow.SucceededProjectClient); ok {
		return client.FetchSucceededProjects(ctx, tomorrow.Session{JWT: token}, username)
	}

	page, err := s.client.FetchProfilePage(ctx, tomorrow.Session{JWT: token}, profilePath)
	if err != nil {
		return nil, err
	}
	return tomorrow.ParseProjects(page, s.baseURL, username)
}
