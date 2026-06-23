package tomorrow

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

type stubTomorrowClient struct {
	session     Session
	profileHTML string
	loginErr    error
	fetchErr    error
}

func (s stubTomorrowClient) Login(context.Context, string, string) (Session, error) {
	return s.session, s.loginErr
}

func (s stubTomorrowClient) FetchProfilePage(context.Context, Session, string) (string, error) {
	return s.profileHTML, s.fetchErr
}

func TestServiceDiscoverSucceededProjectsFiltersResults(t *testing.T) {
	rawHTML, err := os.ReadFile(filepath.Join("testdata", "dmukhat_profile.html"))
	if err != nil {
		t.Fatalf("ReadFile returned error: %v", err)
	}

	service, err := NewService(stubTomorrowClient{
		session:     Session{JWT: "jwt"},
		profileHTML: string(rawHTML),
	}, ServiceConfig{
		BaseURL:  "https://01.tomorrow-school.ai",
		Username: "dmukhat",
		Password: "secret",
	})
	if err != nil {
		t.Fatalf("NewService returned error: %v", err)
	}

	projects, err := service.DiscoverSucceededProjects(context.Background(), DefaultProfilePath)
	if err != nil {
		t.Fatalf("DiscoverSucceededProjects returned error: %v", err)
	}

	if len(projects) != 2 {
		t.Fatalf("len(projects) = %d, want 2", len(projects))
	}
	if projects[0].Slug != "go-reloaded" || projects[1].Slug != "ascii-art" {
		t.Fatalf("projects = %+v, want only succeeded projects in fixture order", projects)
	}
}
