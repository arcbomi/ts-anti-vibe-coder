// Package config loads typed environment configuration shared by backend services.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config contains reusable infrastructure settings used by backend services.
type Config struct {
	AppEnv      string
	ServiceName string
	HTTPPort    string
	LogLevel    string

	DatabaseURL string
	PostgresDSN string // Deprecated alias for DatabaseURL.

	RedisAddr      string
	RedisPassword  string
	RedisDB        int
	QueueNamespace string

	GitLabBaseURL     string
	GitLabBotToken    string
	GitLabBotUsername string

	AIBaseURL        string
	AIAPIKey         string
	AIModel          string
	AITimeoutSeconds int

	JWTSecret          string
	AuthJWTHS256Secret string // Deprecated alias for JWTSecret.
	ExamTimezone       string
	ExamOpenDOW        string
	ExamPassPercent    int
}

// HTTPAddr returns the address string expected by net/http servers.
func (c Config) HTTPAddr() string {
	port := strings.TrimSpace(c.HTTPPort)
	if port == "" {
		port = "8080"
	}
	if strings.HasPrefix(port, ":") {
		return port
	}
	return ":" + port
}

// Load reads the common SDK environment variables without service-specific validation.
func Load() Config {
	cfg, _ := load("")
	return cfg
}

// LoadFromEnv reads common and service-prefixed environment variables for a service.
// A service-prefixed variable such as AUTH_SERVICE_HTTP_PORT overrides HTTP_PORT.
func LoadFromEnv(serviceName string) (Config, error) {
	serviceName = strings.TrimSpace(serviceName)
	if serviceName == "" {
		serviceName = os.Getenv("SERVICE_NAME")
	}
	if serviceName == "" {
		return Config{}, fmt.Errorf("service name is required")
	}
	return load(serviceName)
}

func load(serviceName string) (Config, error) {
	prefix := ""
	if serviceName != "" {
		prefix = toEnvPrefix(serviceName)
	}
	get := func(key string) string {
		if prefix != "" {
			if v := os.Getenv(prefix + key); v != "" {
				return v
			}
		}
		return os.Getenv(key)
	}

	redisDB, err := parseInt(get("REDIS_DB"), 0)
	if err != nil {
		return Config{}, fmt.Errorf("invalid REDIS_DB: %w", err)
	}
	aiTimeout, err := parseInt(get("AI_TIMEOUT_SECONDS"), 60)
	if err != nil {
		return Config{}, fmt.Errorf("invalid AI_TIMEOUT_SECONDS: %w", err)
	}
	passPercent, err := parseInt(get("EXAM_PASS_PERCENT"), 80)
	if err != nil {
		return Config{}, fmt.Errorf("invalid EXAM_PASS_PERCENT: %w", err)
	}

	if serviceName == "" {
		serviceName = firstNonEmpty(get("SERVICE_NAME"), "backend-service")
	}
	databaseURL := firstNonEmpty(get("DATABASE_URL"), get("POSTGRES_DSN"))
	jwtSecret := firstNonEmpty(get("JWT_SECRET"), get("AUTH_JWT_HS256_SECRET"))

	cfg := Config{
		AppEnv:      firstNonEmpty(get("APP_ENV"), "development"),
		ServiceName: serviceName,
		HTTPPort:    firstNonEmpty(get("HTTP_PORT"), defaultPort(serviceName)),
		LogLevel:    firstNonEmpty(get("LOG_LEVEL"), "info"),

		DatabaseURL: databaseURL,
		PostgresDSN: databaseURL,

		RedisAddr:      firstNonEmpty(get("REDIS_ADDR"), "localhost:6379"),
		RedisPassword:  get("REDIS_PASSWORD"),
		RedisDB:        redisDB,
		QueueNamespace: firstNonEmpty(get("QUEUE_NAMESPACE"), "anti_vibe"),

		GitLabBaseURL:     firstNonEmpty(get("GITLAB_BASE_URL"), "https://gitlab.com"),
		GitLabBotToken:    get("GITLAB_BOT_TOKEN"),
		GitLabBotUsername: get("GITLAB_BOT_USERNAME"),

		AIBaseURL:        firstNonEmpty(get("AI_BASE_URL"), "https://api.openai.com"),
		AIAPIKey:         get("AI_API_KEY"),
		AIModel:          firstNonEmpty(get("AI_MODEL"), "gpt-4.1-mini"),
		AITimeoutSeconds: aiTimeout,

		JWTSecret:          jwtSecret,
		AuthJWTHS256Secret: jwtSecret,
		ExamTimezone:       firstNonEmpty(get("EXAM_TIMEZONE"), "Asia/Shanghai"),
		ExamOpenDOW:        firstNonEmpty(get("EXAM_OPEN_DOW"), "Friday"),
		ExamPassPercent:    passPercent,
	}
	return cfg, nil
}

func toEnvPrefix(serviceName string) string {
	s := strings.ToUpper(serviceName)
	s = strings.ReplaceAll(s, "-", "_")
	return s + "_"
}

func defaultPort(serviceName string) string {
	switch serviceName {
	case "api-gateway":
		return "8080"
	case "auth-service":
		return "8081"
	case "gitlab-reader-service":
		return "8082"
	case "ai-analysis-service":
		return "8083"
	case "question-service":
		return "8084"
	case "exam-service":
		return "8085"
	case "scheduler-service":
		return "8086"
	case "worker-service":
		return "8087"
	default:
		return "8080"
	}
}

func parseInt(s string, fallback int) (int, error) {
	if strings.TrimSpace(s) == "" {
		return fallback, nil
	}
	return strconv.Atoi(s)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
