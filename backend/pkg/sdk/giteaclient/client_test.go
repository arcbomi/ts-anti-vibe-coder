package giteaclient

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestSessionCookiesFromTomorrowSchoolJWTReturnsExplicitError(t *testing.T) {
	client := New("https://01.tomorrow-school.ai/git", "")

	_, err := client.SessionCookiesFromTomorrowSchoolJWT(context.Background(), "tomorrow-school-jwt")
	if !errors.Is(err, ErrTomorrowSchoolJWTUnsupported) {
		t.Fatalf("expected unsupported error, got %v", err)
	}
}

func TestListMyRepositoriesUsesCookies(t *testing.T) {
	client := New("https://gitea.example", "")
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.Path != "/api/v1/user/repos" {
				t.Fatalf("path = %s", req.URL.Path)
			}
			if _, err := req.Cookie("i_like_gitea"); err != nil {
				t.Fatalf("expected session cookie, got %v", err)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`[{"id":7,"name":"repo","full_name":"team/repo","default_branch":"main","private":true,"html_url":"https://gitea.example/team/repo","clone_url":"https://gitea.example/team/repo.git"}]`)),
			}, nil
		}),
	}
	repositories, err := client.ListMyRepositories(context.Background(), []*http.Cookie{{Name: "i_like_gitea", Value: "yes"}})
	if err != nil {
		t.Fatalf("ListMyRepositories returned error: %v", err)
	}
	if len(repositories) != 1 {
		t.Fatalf("repository count = %d", len(repositories))
	}
	if repositories[0].FullName != "team/repo" || repositories[0].CloneURL != "https://gitea.example/team/repo.git" {
		t.Fatalf("unexpected repository: %+v", repositories[0])
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}
