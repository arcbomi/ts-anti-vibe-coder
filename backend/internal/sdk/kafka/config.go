package kafka

import (
	"fmt"
	"os"
	"strings"
)

// Config contains the shared Kafka client settings used by backend services.
type Config struct {
	Brokers  []string
	ClientID string
	GroupID  string
}

// LoadConfigFromEnv reads Kafka settings from environment variables.
func LoadConfigFromEnv() (Config, error) {
	cfg := Config{
		Brokers:  splitAndTrim(os.Getenv("KAFKA_BROKERS")),
		ClientID: strings.TrimSpace(os.Getenv("KAFKA_CLIENT_ID")),
		GroupID:  strings.TrimSpace(os.Getenv("KAFKA_GROUP_ID")),
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// Validate checks whether the configuration is usable.
func (c Config) Validate() error {
	if len(c.Brokers) == 0 {
		return fmt.Errorf("KAFKA_BROKERS is required")
	}
	for _, broker := range c.Brokers {
		if broker == "" {
			return fmt.Errorf("KAFKA_BROKERS contains an empty broker entry")
		}
	}
	if c.ClientID == "" {
		return fmt.Errorf("KAFKA_CLIENT_ID is required")
	}
	if c.GroupID == "" {
		return fmt.Errorf("KAFKA_GROUP_ID is required")
	}
	return nil
}

func splitAndTrim(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		out = append(out, part)
	}
	return out
}
