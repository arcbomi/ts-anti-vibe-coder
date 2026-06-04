package config

import "testing"

func TestLoadReadsSharedEnvironment(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("SERVICE_NAME", "auth-service")
	t.Setenv("HTTP_PORT", "9090")
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/app?sslmode=disable")
	t.Setenv("REDIS_ADDR", "redis:6379")
	t.Setenv("REDIS_PASSWORD", "secret")
	t.Setenv("REDIS_DB", "2")
	t.Setenv("GITLAB_BASE_URL", "https://gitlab.example.com")
	t.Setenv("GITLAB_BOT_TOKEN", "gitlab-token")
	t.Setenv("GITLAB_BOT_USERNAME", "bot")
	t.Setenv("AI_BASE_URL", "https://ai.example.com")
	t.Setenv("AI_API_KEY", "ai-key")
	t.Setenv("AI_MODEL", "model")
	t.Setenv("INTERNAL_SERVICE_TOKEN", "internal-token")
	t.Setenv("JWT_SECRET", "jwt-secret")

	cfg := Load()

	if cfg.AppEnv != "test" {
		t.Fatalf("AppEnv = %q, want test", cfg.AppEnv)
	}
	if cfg.ServiceName != "auth-service" {
		t.Fatalf("ServiceName = %q, want auth-service", cfg.ServiceName)
	}
	if cfg.HTTPPort != 9090 || cfg.HTTPAddr() != ":9090" {
		t.Fatalf("HTTPPort/HTTPAddr = %d/%q, want 9090/:9090", cfg.HTTPPort, cfg.HTTPAddr())
	}
	if cfg.DatabaseURL == "" || cfg.PostgresDSN != cfg.DatabaseURL {
		t.Fatalf("DatabaseURL/PostgresDSN alias not populated: %#v", cfg)
	}
	if cfg.RedisAddr != "redis:6379" || cfg.RedisPassword != "secret" || cfg.RedisDB != 2 {
		t.Fatalf("redis config not loaded: %#v", cfg)
	}
	if cfg.GitLabBaseURL != "https://gitlab.example.com" || cfg.GitLabBotToken != "gitlab-token" || cfg.GitLabBotUsername != "bot" {
		t.Fatalf("gitlab config not loaded: %#v", cfg)
	}
	if cfg.AIBaseURL != "https://ai.example.com" || cfg.AIAPIKey != "ai-key" || cfg.AIModel != "model" {
		t.Fatalf("ai config not loaded: %#v", cfg)
	}
	if cfg.InternalServiceToken != "internal-token" {
		t.Fatalf("internal service token not loaded: %#v", cfg)
	}
	if cfg.JWTSecret != "jwt-secret" || cfg.AuthJWTHS256Secret != cfg.JWTSecret {
		t.Fatalf("jwt aliases not loaded: %#v", cfg)
	}
	if cfg.JWTAccessTokenTTLMinutes != 60 || cfg.JWTRefreshTokenTTLDays != 30 {
		t.Fatalf("jwt ttl defaults not loaded: %#v", cfg)
	}
}

func TestLoadFromEnvAllowsServicePrefixedOverrides(t *testing.T) {
	t.Setenv("HTTP_PORT", "8080")
	t.Setenv("AUTH_SERVICE_PORT", "8081")
	t.Setenv("DATABASE_URL", "postgres://global")
	t.Setenv("AUTH_SERVICE_DATABASE_URL", "postgres://service")

	cfg, err := LoadFromEnv("auth-service")
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if cfg.ServiceName != "auth-service" {
		t.Fatalf("ServiceName = %q, want auth-service", cfg.ServiceName)
	}
	if cfg.HTTPPort != 8081 {
		t.Fatalf("HTTPPort = %d, want prefixed override 8081", cfg.HTTPPort)
	}
	if cfg.DatabaseURL != "postgres://service" {
		t.Fatalf("DatabaseURL = %q, want prefixed override", cfg.DatabaseURL)
	}
}

func TestLoadFromEnvRejectsInvalidIntegerValues(t *testing.T) {
	t.Setenv("REDIS_DB", "not-an-int")

	_, err := LoadFromEnv("worker-service")
	if err == nil {
		t.Fatal("LoadFromEnv returned nil error for invalid REDIS_DB")
	}
}

func TestLoadFromEnvDefaultsExamOpenDOWToFriday(t *testing.T) {
	cfg, err := LoadFromEnv("exam-service")
	if err != nil {
		t.Fatalf("LoadFromEnv returned error: %v", err)
	}
	if cfg.ExamOpenDOW != "Friday" {
		t.Fatalf("ExamOpenDOW = %q, want Friday", cfg.ExamOpenDOW)
	}
}
