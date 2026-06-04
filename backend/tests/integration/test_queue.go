//go:build integration
// +build integration

package integration

import (
	"context"
	"os"
	"strings"
	"testing"

	"backend/pkg/sdk/queue"

	"github.com/redis/go-redis/v9"
)

func openTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	addr := strings.TrimSpace(os.Getenv("TEST_REDIS_ADDR"))
	if addr == "" {
		addr = strings.TrimSpace(os.Getenv("REDIS_ADDR"))
	}
	if addr == "" {
		addr = "localhost:6379"
	}
	client := queue.NewRedisClient(queue.RedisConfig{Addr: addr, Password: os.Getenv("TEST_REDIS_PASSWORD"), DB: 15})
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("Redis integration queue is unavailable at %s: %v", addr, err)
	}
	if err := client.FlushDB(ctx).Err(); err != nil {
		t.Fatalf("flush Redis integration db: %v", err)
	}
	t.Cleanup(func() { _ = client.FlushDB(context.Background()).Err(); _ = client.Close() })
	return client
}
