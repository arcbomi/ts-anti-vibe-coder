package tomorrow

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseProjectsExtractsCardsAndKeepsOnlySucceededAtServiceLayer(t *testing.T) {
	rawHTML, err := os.ReadFile(filepath.Join("testdata", "dmukhat_profile.html"))
	if err != nil {
		t.Fatalf("ReadFile returned error: %v", err)
	}

	projects, err := ParseProjects(string(rawHTML), "https://01.tomorrow-school.ai", "dmukhat")
	if err != nil {
		t.Fatalf("ParseProjects returned error: %v", err)
	}

	if len(projects) != 4 {
		t.Fatalf("len(projects) = %d, want 4", len(projects))
	}

	got := map[string]Project{}
	for _, project := range projects {
		got[project.Slug] = project
	}

	if got["go-reloaded"].Status != succeededStatusText || !got["go-reloaded"].IsSucceeded {
		t.Fatalf("go-reloaded = %+v, want succeeded project", got["go-reloaded"])
	}
	if got["go-reloaded"].RepoURL != "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded" {
		t.Fatalf("go-reloaded repo = %q", got["go-reloaded"].RepoURL)
	}
	if got["go-reloaded"].AuditText != "5 peer audits required" {
		t.Fatalf("go-reloaded audit text = %q", got["go-reloaded"].AuditText)
	}

	if got["ascii-art"].Status != succeededStatusText || !got["ascii-art"].IsSucceeded {
		t.Fatalf("ascii-art = %+v, want succeeded project", got["ascii-art"])
	}
	if got["ascii-art"].RepoURL != "https://01.tomorrow-school.ai/git/dmukhat/ascii-art" {
		t.Fatalf("ascii-art repo = %q", got["ascii-art"].RepoURL)
	}

	if got["graphql"].IsSucceeded {
		t.Fatalf("graphql should not be marked succeeded: %+v", got["graphql"])
	}
	if got["unlock-me"].IsSucceeded {
		t.Fatalf("unlock-me should not be marked succeeded: %+v", got["unlock-me"])
	}
}

func TestParseProjectsReturnsClearErrorWhenMarkupDoesNotContainCards(t *testing.T) {
	_, err := ParseProjects(`<html><body><main><h1>Profile</h1></main></body></html>`, "https://01.tomorrow-school.ai", "dmukhat")
	if err == nil {
		t.Fatal("ParseProjects returned nil error")
	}
	if got := err.Error(); got == "" || !strings.Contains(got, ErrProfileFormatChanged.Error()) {
		t.Fatalf("ParseProjects error = %v, want ErrProfileFormatChanged", err)
	}
}
