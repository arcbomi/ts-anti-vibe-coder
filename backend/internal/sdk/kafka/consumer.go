package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	kafkago "github.com/segmentio/kafka-go"
)

// Delivery contains a consumed event envelope and Kafka metadata.
type Delivery[T any] struct {
	Envelope  EventEnvelope[T]
	Topic     string
	Key       []byte
	Partition int
	Offset    int64
}

// Handler processes a consumed event. Returning an error leaves the message
// uncommitted so Kafka can retry delivery later.
type Handler[T any] func(context.Context, Delivery[T]) error

// Consumer wraps Kafka readers and coordinates graceful shutdown.
type Consumer struct {
	cfg     Config
	dialer  *kafkago.Dialer
	mu      sync.Mutex
	readers []*kafkago.Reader
}

// NewConsumer creates a reusable consumer factory.
func NewConsumer(cfg Config) (*Consumer, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &Consumer{
		cfg: cfg,
		dialer: &kafkago.Dialer{
			ClientID: cfg.ClientID,
			Timeout:  10 * time.Second,
		},
	}, nil
}

// Consume reads JSON envelopes from a topic until the context is canceled or an unrecoverable error occurs.
func Consume[T any](ctx context.Context, c *Consumer, topic string, handler Handler[T]) error {
	if c == nil {
		return fmt.Errorf("consumer is required")
	}
	if topic == "" {
		return fmt.Errorf("topic is required")
	}
	if handler == nil {
		return fmt.Errorf("handler is required")
	}

	reader := c.newReader(topic)
	defer c.removeAndCloseReader(reader)

	for {
		msg, err := reader.FetchMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return nil
			}
			return err
		}

		var envelope EventEnvelope[T]
		if err := json.Unmarshal(msg.Value, &envelope); err != nil {
			return fmt.Errorf("decode envelope: %w", err)
		}
		if err := envelope.Validate(); err != nil {
			return fmt.Errorf("validate envelope: %w", err)
		}
		if envelope.EventType != topic {
			return fmt.Errorf("event_type %q does not match consumed topic %q", envelope.EventType, topic)
		}

		delivery := Delivery[T]{
			Envelope:  envelope,
			Topic:     msg.Topic,
			Key:       msg.Key,
			Partition: msg.Partition,
			Offset:    msg.Offset,
		}
		if err := handler(ctx, delivery); err != nil {
			return err
		}
		if err := reader.CommitMessages(ctx, msg); err != nil {
			return err
		}
	}
}

// Close gracefully closes all active readers.
func (c *Consumer) Close() error {
	if c == nil {
		return nil
	}
	c.mu.Lock()
	readers := append([]*kafkago.Reader(nil), c.readers...)
	c.readers = nil
	c.mu.Unlock()

	var firstErr error
	for _, reader := range readers {
		if err := reader.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (c *Consumer) newReader(topic string) *kafkago.Reader {
	reader := kafkago.NewReader(kafkago.ReaderConfig{
		Brokers:        append([]string(nil), c.cfg.Brokers...),
		GroupID:        c.cfg.GroupID,
		Topic:          topic,
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: 0,
		Dialer:         c.dialer,
	})
	c.mu.Lock()
	c.readers = append(c.readers, reader)
	c.mu.Unlock()
	return reader
}

func (c *Consumer) removeAndCloseReader(reader *kafkago.Reader) {
	c.mu.Lock()
	for i, current := range c.readers {
		if current == reader {
			c.readers = append(c.readers[:i], c.readers[i+1:]...)
			break
		}
	}
	c.mu.Unlock()
	_ = reader.Close()
}
