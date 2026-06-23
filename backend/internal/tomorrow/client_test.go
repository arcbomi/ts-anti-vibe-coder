package tomorrow

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchSucceededProjectsUsesGraphQLProgress(t *testing.T) {
	var authorization string
	var request graphQLRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/graphql-engine/v1/graphql" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		authorization = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data":{"progress":[
				{"grade":1.2,"path":"/astanahub/module/go-reloaded","object":{"name":"go-reloaded","type":"project"}},
				{"grade":1.2,"path":"/astanahub/module/dockerize","object":{"name":"ascii-art-web-dockerize","type":"project"}},
				{"grade":1.2,"path":"/astanahub/module/ascii-art","object":{"name":"ascii-art","type":"project"}},
				{"grade":1,"path":"/astanahub/module/checkpoint-zero","object":{"name":"checkpoint-zero","type":"exam"}}
			],"groups":[
				{"path":"/astanahub/module/ascii-art","captainLogin":"dsh","members":[{"userId":15909,"accepted":null}],"event":{"path":"/astanahub/module/ascii-art"}},
				{"path":"/astanahub/module/ascii-art","captainLogin":"azhengiskh","members":[{"userId":15909,"accepted":true}],"event":{"path":"/astanahub/module/ascii-art"}}
			]}
		}`))
	}))
	defer server.Close()

	client, err := NewHTTPClient(HTTPClientConfig{BaseURL: server.URL, HTTPClient: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	token := testJWT(`{"sub":"15909"}`)
	projects, err := client.FetchSucceededProjects(context.Background(), Session{JWT: token}, "dmukhat")
	if err != nil {
		t.Fatal(err)
	}
	if authorization != "Bearer "+token {
		t.Fatalf("Authorization = %q", authorization)
	}
	if request.Variables["eventId"] != float64(DefaultEventID) {
		t.Fatalf("eventId = %#v", request.Variables["eventId"])
	}
	if len(projects) != 3 {
		t.Fatalf("projects = %+v", projects)
	}
	if projects[0].Slug != "go-reloaded" || projects[0].RepoURL != server.URL+"/git/dmukhat/go-reloaded" {
		t.Fatalf("first project = %+v", projects[0])
	}
	if projects[1].Slug != "ascii-art-web-dockerize" {
		t.Fatalf("second project = %+v", projects[1])
	}
	if projects[2].Slug != "ascii-art" || projects[2].RepoURL != server.URL+"/git/azhengiskh/ascii-art" {
		t.Fatalf("group project = %+v", projects[2])
	}
}

func TestUserIDFromJWTAcceptsHasuraClaim(t *testing.T) {
	token := testJWT(`{"https://hasura.io/jwt/claims":{"x-hasura-user-id":"15909"}}`)
	userID, err := userIDFromJWT(token)
	if err != nil {
		t.Fatal(err)
	}
	if userID != 15909 {
		t.Fatalf("userID = %d", userID)
	}
}

func testJWT(claims string) string {
	encode := func(value string) string {
		return base64.RawURLEncoding.EncodeToString([]byte(value))
	}
	return strings.Join([]string{encode(`{"alg":"none"}`), encode(claims), encode(fmt.Sprint("signature"))}, ".")
}
