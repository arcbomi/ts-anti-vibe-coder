//go:build smoke

package smoke

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"backend/pkg/sdk/config"
	"backend/pkg/sdk/database"
	"backend/pkg/sdk/queue"
)

const smokeTimeout = 2 * time.Second

func TestBackendServicesAreAlive(t *testing.T) {
	services := map[string]string{
		"api gateway":          envOrDefault("SMOKE_API_GATEWAY_URL", "http://localhost:8080"),
		"auth service":         envOrDefault("SMOKE_AUTH_SERVICE_URL", "http://localhost:8081"),
		"gitea reader service": envOrDefault("SMOKE_GITEA_READER_SERVICE_URL", "http://localhost:8082"),
		"ai analysis service":  envOrDefault("SMOKE_AI_ANALYSIS_SERVICE_URL", "http://localhost:8083"),
		"question service":     envOrDefault("SMOKE_QUESTION_SERVICE_URL", "http://localhost:8084"),
		"exam service":         envOrDefault("SMOKE_EXAM_SERVICE_URL", "http://localhost:8085"),
		"scheduler service":    envOrDefault("SMOKE_SCHEDULER_SERVICE_URL", "http://localhost:8086"),
		"worker service":       envOrDefault("SMOKE_WORKER_SERVICE_URL", "http://localhost:8087"),
	}

	for name, baseURL := range services {
		name, baseURL := name, baseURL
		t.Run(name, func(t *testing.T) {
			expectOK(t, joinURL(baseURL, "/healthz"))
		})
	}
}

func TestFrontendLoads(t *testing.T) {
	frontendURL := envOrDefault("SMOKE_FRONTEND_URL", "http://localhost:5173")
	expectOK(t, frontendURL)
}

func TestExamPageCanOpen(t *testing.T) {
	frontendURL := envOrDefault("SMOKE_FRONTEND_URL", "http://localhost:5173")
	expectOK(t, joinURL(frontendURL, "/exam/smoke-exam"))
}

func TestDatabaseAndQueueConnections(t *testing.T) {
	cfg, err := config.LoadFromEnv("worker-service")
	if err != nil {
		t.Fatalf("load worker config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), smokeTimeout)
	defer cancel()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		t.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()
	if err := database.Ping(ctx, db); err != nil {
		t.Fatalf("database ping failed: %v", err)
	}

	redisClient := queue.NewRedisClient(queue.RedisConfig{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB})
	defer redisClient.Close()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Fatalf("queue ping failed: %v", err)
	}
}

func TestRequiredDeploymentConfigExists(t *testing.T) {
	cfg, err := config.LoadFromEnv("worker-service")
	if err != nil {
		t.Fatalf("load worker config: %v", err)
	}
	checks := map[string]string{
		"AI_BASE_URL":          cfg.AIBaseURL,
		"AI_API_KEY":           cfg.AIAPIKey,
		"AI_MODEL":             cfg.AIModel,
		"GITEA_BASE_URL":       cfg.GiteaBaseURL,
		"GITEA_BOT_TOKEN":      cfg.GiteaBotToken,
		"GITEA_BOT_USERNAME":   cfg.GiteaBotUsername,
		"DATABASE_URL":         cfg.DatabaseURL,
		"REDIS_ADDR/QUEUE_URL": cfg.RedisAddr,
	}
	for name, value := range checks {
		if isMissing(value) {
			t.Fatalf("required smoke config %s is missing or still set to a placeholder", name)
		}
	}
}

func TestBasicRepositoryFlowDoesNotCrash(t *testing.T) {
	baseURL := envOrDefault("SMOKE_GITEA_READER_SERVICE_URL", "http://localhost:8082")
	endpoint := joinURL(baseURL, "/repositories")
	body := strings.NewReader(`{"gitea_repo_url":"not-a-valid-repository-url"}`)
	req, err := http.NewRequest(http.MethodPost, endpoint, body)
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer smoke-user")
	req.Header.Set("X-User-Id", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("Content-Type", "application/json")

	res, responseBody, err := doRequest(req)
	if err != nil {
		t.Fatalf("repository smoke request failed: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= http.StatusInternalServerError {
		t.Fatalf("repository flow crashed with status=%d body=%s", res.StatusCode, responseBody)
	}
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected fast validation response status=400, got status=%d body=%s", res.StatusCode, responseBody)
	}
}

func expectOK(t *testing.T, rawURL string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		t.Fatalf("create request for %s: %v", rawURL, err)
	}
	res, body, err := doRequest(req)
	if err != nil {
		t.Fatalf("GET %s failed: %v", rawURL, err)
	}
	defer res.Body.Close()
	if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
		t.Fatalf("GET %s returned status=%d body=%s", rawURL, res.StatusCode, body)
	}
}

func doRequest(req *http.Request) (*http.Response, string, error) {
	ctx, cancel := context.WithTimeout(req.Context(), smokeTimeout)
	defer cancel()
	res, err := (&http.Client{Timeout: smokeTimeout}).Do(req.WithContext(ctx))
	if err != nil {
		return nil, "", err
	}
	body, readErr := io.ReadAll(io.LimitReader(res.Body, 4096))
	if readErr != nil {
		return res, "", fmt.Errorf("read response body: %w", readErr)
	}
	return res, string(body), nil
}

func joinURL(baseURL, path string) string {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return strings.TrimRight(baseURL, "/") + path
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + path
	return parsed.String()
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(testingEnv(key)); value != "" {
		return value
	}
	return fallback
}

func testingEnv(key string) string {
	return strings.TrimSpace(strings.Trim(strings.ReplaceAll(strings.ReplaceAll(os.Getenv(key), "\n", ""), "\r", ""), "\""))
}

func isMissing(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return true
	}
	placeholder := strings.ToLower(trimmed)
	return placeholder == "replace_me" || placeholder == "changeme" || placeholder == "change-me"
}
