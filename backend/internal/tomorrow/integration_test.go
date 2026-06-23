package tomorrow

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestTomorrowProjectDiscoveryIntegration(t *testing.T) {
	if os.Getenv("RUN_TOMORROW_INTEGRATION") != "true" {
		t.Skip("set RUN_TOMORROW_INTEGRATION=true to run live Tomorrow integration test")
	}
	baseURL := os.Getenv("TOMORROW_BASE_URL")
	password := os.Getenv("TOMORROW_PASSWORD")
	if baseURL == "" || password == "" {
		t.Skip("set TOMORROW_BASE_URL and TOMORROW_PASSWORD to run live Tomorrow integration test")
	}

	client, err := NewHTTPClient(HTTPClientConfig{
		BaseURL: baseURL,
		Timeout: 20 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewHTTPClient returned error: %v", err)
	}
	service, err := NewService(client, ServiceConfig{
		BaseURL:  baseURL,
		Username: DefaultUsername,
		Password: password,
	})
	if err != nil {
		t.Fatalf("NewService returned error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	projects, err := service.DiscoverSucceededProjects(ctx, DefaultProfilePath)
	if err != nil {
		t.Fatalf("DiscoverSucceededProjects returned error: %v", err)
	}
	if len(projects) == 0 {
		t.Fatal("DiscoverSucceededProjects returned no succeeded projects")
	}

	found := map[string]bool{}
	for _, project := range projects {
		if !project.IsSucceeded {
			t.Fatalf("project %q is not succeeded: %+v", project.Slug, project)
		}
		found[project.Slug] = true
	}
	if !found["go-reloaded"] {
		t.Fatalf("expected go-reloaded in succeeded projects, got %+v", projects)
	}
	if !found["ascii-art"] {
		t.Fatalf("expected ascii-art in succeeded projects, got %+v", projects)
	}
}
