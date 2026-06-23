package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	kafkago "github.com/segmentio/kafka-go"
)

// Producer wraps a Kafka writer for publishing JSON envelopes.
type Producer struct {
	writer   *kafkago.Writer
	producer string
}

type publishableEnvelope interface {
	Validate() error
	EventIDValue() string
	EventTypeValue() string
	OccurredAtValue() time.Time
}

// NewProducer constructs a producer with sane shared defaults.
func NewProducer(cfg Config) (*Producer, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &Producer{
		writer: &kafkago.Writer{
			Addr:                   kafkago.TCP(cfg.Brokers...),
			Balancer:               &kafkago.LeastBytes{},
			AllowAutoTopicCreation: false,
			RequiredAcks:           kafkago.RequireAll,
			BatchTimeout:           50 * time.Millisecond,
			Transport: &kafkago.Transport{
				ClientID: cfg.ClientID,
			},
		},
		producer: cfg.ClientID,
	}, nil
}

// Publish writes a prebuilt event envelope to a topic.
func (p *Producer) Publish(ctx context.Context, topic string, envelope publishableEnvelope) error {
	if p == nil || p.writer == nil {
		return fmt.Errorf("producer is not initialized")
	}
	if topic == "" {
		return fmt.Errorf("topic is required")
	}
	if envelope == nil {
		return fmt.Errorf("envelope is required")
	}
	if err := envelope.Validate(); err != nil {
		return err
	}
	if envelope.EventTypeValue() != topic {
		return fmt.Errorf("event_type %q must match topic %q", envelope.EventTypeValue(), topic)
	}
	payload, err := json.Marshal(envelope)
	if err != nil {
		return err
	}
	return p.writer.WriteMessages(ctx, kafkago.Message{
		Topic: topic,
		Key:   []byte(envelope.EventIDValue()),
		Value: payload,
		Time:  envelope.OccurredAtValue(),
	})
}

// PublishPayload creates and publishes an envelope for the payload.
func PublishPayload[T any](ctx context.Context, p *Producer, topic string, payload T) error {
	if p == nil {
		return fmt.Errorf("producer is required")
	}
	envelope, err := NewEnvelope(topic, p.producer, payload)
	if err != nil {
		return err
	}
	return p.Publish(ctx, topic, envelope)
}

// Close gracefully flushes and closes the Kafka writer.
func (p *Producer) Close() error {
	if p == nil || p.writer == nil {
		return nil
	}
	return p.writer.Close()
}
