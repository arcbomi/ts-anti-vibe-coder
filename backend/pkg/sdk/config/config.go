// Package config loads typed environment configuration shared by backend services.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// Config contains reusable infrastructure settings used by backend services.
//
// The fields intentionally keep the original service-facing names (for example
// HTTPPort as an int and PostgresDSN) while also exposing the newer shared SDK
// names (for example AppEnv, DatabaseURL, RedisDB, and JWTSecret). Keeping both
// sets avoids forcing every service to change at once and makes this file safe
// to merge with branches that still use the earlier config contract.
type Config struct {
	AppEnv      string
	ServiceName string
	LogLevel    string
	HTTPPort    int

	DevSeedUserName     string
	DevSeedUserEmail    string
	DevSeedUserPassword string

	DatabaseURL string
	PostgresDSN string // Deprecated alias for DatabaseURL.

	RedisAddr                   string
	RedisPassword               string
	RedisDB                     int
	QueueNamespace              string
	QueueURL                    string
	AnalysisQueueName           string
	AnalysisDeadLetterQueueName string
	WorkerConcurrency           int
	MaxJobAttempts              int
	RetryDelaySeconds           int

	GitLabBaseURL     string
	GitLabBotToken    string
	GitLabBotUsername string

	AIBaseURL            string
	AIAPIKey             string
	AIModel              string
	AITimeoutSeconds     int
	InternalServiceToken string

	JWTSecret                     string
	AuthJWTHS256Secret            string // Deprecated alias for JWTSecret.
	JWTAccessTokenTTLMinutes      int
	JWTRefreshTokenTTLDays        int
	TomorrowSchoolSSOClientID     string
	TomorrowSchoolSSOClientSecret string
	TomorrowSchoolSSORedirectURL  string

	ExamTimezone    string
	ExamOpenDOW     string
	ExamPassPercent int
}

// HTTPAddr returns the address string expected by net/http servers.
func (c Config) HTTPAddr() string {
	if c.HTTPPort <= 0 {
		return ":8080"
	}
	return fmt.Sprintf(":%d", c.HTTPPort)
}

// Load reads common SDK environment variables without requiring a caller to
// provide a service name. Use LoadFromEnv when a service wants prefixed override
// support and parse errors returned to the caller.
func Load() Config {
	cfg, err := load(os.Getenv("SERVICE_NAME"), false)
	if err != nil {
		return Config{AppEnv: "development", ServiceName: "backend-service", HTTPPort: 8080}
	}
	return cfg
}

// LoadFromEnv reads common and service-prefixed environment variables for a service.
// A service-prefixed variable such as AUTH_SERVICE_HTTP_PORT or AUTH_SERVICE_PORT overrides HTTP_PORT.
func LoadFromEnv(serviceName string) (Config, error) {
	serviceName = strings.TrimSpace(serviceName)
	if serviceName == "" {
		serviceName = strings.TrimSpace(os.Getenv("SERVICE_NAME"))
	}
	if serviceName == "" {
		return Config{}, errors.New("serviceName is required")
	}
	return load(serviceName, true)
}

func load(serviceName string, allowServicePrefix bool) (Config, error) {
	serviceName = strings.TrimSpace(serviceName)
	prefix := ""
	if allowServicePrefix && serviceName != "" {
		prefix = toEnvPrefix(serviceName)
	}
	getPrefixed := func(key string) string {
		if prefix == "" {
			return ""
		}
		return os.Getenv(prefix + key)
	}
	get := func(key string) string {
		if v := getPrefixed(key); v != "" {
			return v
		}
		return os.Getenv(key)
	}

	if serviceName == "" {
		serviceName = firstNonEmpty(get("SERVICE_NAME"), "backend-service")
	}

	httpPort, err := parseInt(firstNonEmpty(getPrefixed("HTTP_PORT"), getPrefixed("PORT"), os.Getenv("HTTP_PORT"), os.Getenv("PORT")), 0)
	if err != nil {
		return Config{}, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}
	if httpPort == 0 {
		httpPort = defaultPort(serviceName)
	}

	redisDB, err := parseInt(get("REDIS_DB"), 0)
	if err != nil {
		return Config{}, fmt.Errorf("invalid REDIS_DB: %w", err)
	}
	workerConcurrency, err := parseInt(get("WORKER_CONCURRENCY"), 3)
	if err != nil {
		return Config{}, fmt.Errorf("invalid WORKER_CONCURRENCY: %w", err)
	}
	maxJobAttempts, err := parseInt(get("MAX_JOB_ATTEMPTS"), 3)
	if err != nil {
		return Config{}, fmt.Errorf("invalid MAX_JOB_ATTEMPTS: %w", err)
	}
	retryDelaySeconds, err := parseInt(get("RETRY_DELAY_SECONDS"), 30)
	if err != nil {
		return Config{}, fmt.Errorf("invalid RETRY_DELAY_SECONDS: %w", err)
	}
	aiTimeout, err := parseInt(get("AI_TIMEOUT_SECONDS"), 60)
	if err != nil {
		return Config{}, fmt.Errorf("invalid AI_TIMEOUT_SECONDS: %w", err)
	}
	passPercent, err := parseInt(get("EXAM_PASS_PERCENT"), 70)
	if err != nil {
		return Config{}, fmt.Errorf("invalid EXAM_PASS_PERCENT: %w", err)
	}
	jwtAccessTTL, err := parseInt(get("JWT_ACCESS_TOKEN_TTL_MINUTES"), 60)
	if err != nil {
		return Config{}, fmt.Errorf("invalid JWT_ACCESS_TOKEN_TTL_MINUTES: %w", err)
	}
	jwtRefreshTTL, err := parseInt(get("JWT_REFRESH_TOKEN_TTL_DAYS"), 30)
	if err != nil {
		return Config{}, fmt.Errorf("invalid JWT_REFRESH_TOKEN_TTL_DAYS: %w", err)
	}

	databaseURL := firstNonEmpty(get("DATABASE_URL"), get("POSTGRES_DSN"))
	queueURL := get("QUEUE_URL")
	redisAddr := firstNonEmpty(get("REDIS_ADDR"), redisAddrFromURL(queueURL), "localhost:6379")
	jwtSecret := firstNonEmpty(get("JWT_SECRET"), get("AUTH_JWT_HS256_SECRET"))

	cfg := Config{
		AppEnv:              firstNonEmpty(get("APP_ENV"), "development"),
		ServiceName:         serviceName,
		LogLevel:            firstNonEmpty(get("LOG_LEVEL"), "info"),
		HTTPPort:            httpPort,
		DevSeedUserName:     firstNonEmpty(get("DEV_SEED_USER_NAME"), "Student User"),
		DevSeedUserEmail:    firstNonEmpty(get("DEV_SEED_USER_EMAIL"), "student@example.com"),
		DevSeedUserPassword: firstNonEmpty(get("DEV_SEED_USER_PASSWORD"), "correct-password"),

		DatabaseURL: databaseURL,
		PostgresDSN: databaseURL,

		RedisAddr:                   redisAddr,
		RedisPassword:               firstNonEmpty(get("REDIS_PASSWORD"), redisPasswordFromURL(queueURL)),
		RedisDB:                     redisDB,
		QueueNamespace:              firstNonEmpty(get("QUEUE_NAMESPACE"), "anti_vibe"),
		QueueURL:                    queueURL,
		AnalysisQueueName:           firstNonEmpty(get("ANALYSIS_QUEUE_NAME"), "analysis_jobs"),
		AnalysisDeadLetterQueueName: firstNonEmpty(get("ANALYSIS_DEAD_LETTER_QUEUE_NAME"), "analysis_jobs_dead"),
		WorkerConcurrency:           workerConcurrency,
		MaxJobAttempts:              maxJobAttempts,
		RetryDelaySeconds:           retryDelaySeconds,

		GitLabBaseURL:     firstNonEmpty(get("GITLAB_BASE_URL"), "https://gitlab.com"),
		GitLabBotToken:    get("GITLAB_BOT_TOKEN"),
		GitLabBotUsername: get("GITLAB_BOT_USERNAME"),

		AIBaseURL:            firstNonEmpty(get("AI_BASE_URL"), "https://api.openai.com"),
		AIAPIKey:             get("AI_API_KEY"),
		AIModel:              firstNonEmpty(get("AI_MODEL"), "gpt-4.1-mini"),
		AITimeoutSeconds:     aiTimeout,
		InternalServiceToken: get("INTERNAL_SERVICE_TOKEN"),

		JWTSecret:                     jwtSecret,
		AuthJWTHS256Secret:            jwtSecret,
		JWTAccessTokenTTLMinutes:      jwtAccessTTL,
		JWTRefreshTokenTTLDays:        jwtRefreshTTL,
		TomorrowSchoolSSOClientID:     get("TOMORROW_SCHOOL_SSO_CLIENT_ID"),
		TomorrowSchoolSSOClientSecret: get("TOMORROW_SCHOOL_SSO_CLIENT_SECRET"),
		TomorrowSchoolSSORedirectURL:  get("TOMORROW_SCHOOL_SSO_REDIRECT_URL"),

		ExamTimezone:    firstNonEmpty(get("EXAM_TIMEZONE"), "Asia/Shanghai"),
		ExamOpenDOW:     firstNonEmpty(get("EXAM_OPEN_DOW"), "Friday"),
		ExamPassPercent: passPercent,
	}
	return cfg, nil
}

func redisAddrFromURL(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return ""
	}
	return u.Host
}

func redisPasswordFromURL(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.User == nil {
		return ""
	}
	password, _ := u.User.Password()
	return password
}

func toEnvPrefix(serviceName string) string {
	s := strings.ToUpper(serviceName)
	s = strings.ReplaceAll(s, "-", "_")
	return s + "_"
}

func defaultPort(serviceName string) int {
	switch serviceName {
	case "api-gateway":
		return 8080
	case "auth-service":
		return 8081
	case "gitlab-reader-service":
		return 8082
	case "ai-analysis-service":
		return 8083
	case "question-service":
		return 8084
	case "exam-service":
		return 8085
	case "scheduler-service":
		return 8086
	case "worker-service":
		return 8087
	default:
		return 8080
	}
}

func parseInt(s string, fallback int) (int, error) {
	if strings.TrimSpace(s) == "" {
		return fallback, nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0, err
	}
	return v, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
