package config

import (
  "errors"
  "fmt"
  "os"
  "strconv"
  "strings"
)

type Config struct {
  ServiceName string
  LogLevel    string
  HTTPPort    int

  PostgresDSN string

  RedisAddr     string
  RedisPassword string
  QueueNamespace string

  GitLabBaseURL     string
  GitLabBotToken    string
  GitLabBotUsername string

  AIBaseURL        string
  AIAPIKey         string
  AIModel          string
  AITimeoutSeconds int

  ExamTimezone   string
  ExamOpenDOW    string
  ExamPassPercent int

  AuthJWTHS256Secret string
}

func (c Config) HTTPAddr() string {
  return fmt.Sprintf(":%d", c.HTTPPort)
}

func LoadFromEnv(serviceName string) (Config, error) {
  serviceName = strings.TrimSpace(serviceName)
  if serviceName == "" {
    return Config{}, errors.New("serviceName is required")
  }

  prefix := toEnvPrefix(serviceName)
  get := func(key string) string {
    if v := os.Getenv(prefix + key); v != "" {
      return v
    }
    return os.Getenv(key)
  }

  httpPort, err := parseInt(get("HTTP_PORT"), 0)
  if err != nil {
    return Config{}, fmt.Errorf("invalid HTTP_PORT: %w", err)
  }
  if httpPort == 0 {
    // Default per service if prefixed var was not set.
    httpPort = defaultPort(serviceName)
  }

  aiTimeout, err := parseInt(get("AI_TIMEOUT_SECONDS"), 60)
  if err != nil {
    return Config{}, fmt.Errorf("invalid AI_TIMEOUT_SECONDS: %w", err)
  }

  passPercent, err := parseInt(get("EXAM_PASS_PERCENT"), 70)
  if err != nil {
    return Config{}, fmt.Errorf("invalid EXAM_PASS_PERCENT: %w", err)
  }

  cfg := Config{
    ServiceName: serviceName,
    LogLevel:    firstNonEmpty(get("LOG_LEVEL"), "info"),
    HTTPPort:    httpPort,
    PostgresDSN: get("POSTGRES_DSN"),

    RedisAddr:      firstNonEmpty(get("REDIS_ADDR"), "localhost:6379"),
    RedisPassword:  get("REDIS_PASSWORD"),
    QueueNamespace: firstNonEmpty(get("QUEUE_NAMESPACE"), "anti_vibe"),

    GitLabBaseURL:     firstNonEmpty(get("GITLAB_BASE_URL"), "https://gitlab.com"),
    GitLabBotToken:    get("GITLAB_BOT_TOKEN"),
    GitLabBotUsername: get("GITLAB_BOT_USERNAME"),

    AIBaseURL:        firstNonEmpty(get("AI_BASE_URL"), "https://api.openai.com"),
    AIAPIKey:         get("AI_API_KEY"),
    AIModel:          firstNonEmpty(get("AI_MODEL"), "gpt-4.1-mini"),
    AITimeoutSeconds: aiTimeout,

    ExamTimezone:    firstNonEmpty(get("EXAM_TIMEZONE"), "Asia/Shanghai"),
    ExamOpenDOW:     firstNonEmpty(get("EXAM_OPEN_DOW"), "Friday"),
    ExamPassPercent: passPercent,

    AuthJWTHS256Secret: get("AUTH_JWT_HS256_SECRET"),
  }

  // Minimal validation (MVP). Secrets can be empty in dev, but production should enforce.
  return cfg, nil
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

func firstNonEmpty(v string, fallback string) string {
  if strings.TrimSpace(v) == "" {
    return fallback
  }
  return v
}
