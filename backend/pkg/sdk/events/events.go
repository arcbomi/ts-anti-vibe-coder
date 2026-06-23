package events

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type Publisher interface {
	Publish(ctx context.Context, eventName string, payload any) error
}

type RedisPublisher struct {
	redis *redis.Client
}

func NewRedisPublisher(redisClient *redis.Client) *RedisPublisher {
	return &RedisPublisher{redis: redisClient}
}

func (p *RedisPublisher) Publish(ctx context.Context, eventName string, payload any) error {
	if p == nil || p.redis == nil {
		return fmt.Errorf("redis client is required")
	}
	if eventName == "" {
		return fmt.Errorf("event name is required")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return p.redis.Publish(ctx, eventName, body).Err()
}
