package kafka

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/google/uuid"
)

var eventTypePattern = regexp.MustCompile(`^[a-z]+(\.[a-z_]+)+\.v[1-9][0-9]*$`)

// Validatable allows payloads to participate in envelope validation.
type Validatable interface {
	Validate() error
}

// EventEnvelope is the shared JSON envelope used for Kafka events.
type EventEnvelope[T any] struct {
	EventID      string    `json:"event_id"`
	EventType    string    `json:"event_type"`
	EventVersion int       `json:"event_version"`
	OccurredAt   time.Time `json:"occurred_at"`
	Producer     string    `json:"producer"`
	Payload      T         `json:"payload"`
}

// EventIDValue exposes the envelope event ID to non-generic helpers.
func (e EventEnvelope[T]) EventIDValue() string {
	return e.EventID
}

// EventTypeValue exposes the envelope event type to non-generic helpers.
func (e EventEnvelope[T]) EventTypeValue() string {
	return e.EventType
}

// OccurredAtValue exposes the envelope timestamp to non-generic helpers.
func (e EventEnvelope[T]) OccurredAtValue() time.Time {
	return e.OccurredAt
}

// NewEnvelope creates a validated envelope with generated ID and UTC timestamp.
func NewEnvelope[T any](eventType string, producer string, payload T) (EventEnvelope[T], error) {
	version, err := EventVersionFromType(eventType)
	if err != nil {
		return EventEnvelope[T]{}, err
	}
	envelope := EventEnvelope[T]{
		EventID:      uuid.NewString(),
		EventType:    eventType,
		EventVersion: version,
		OccurredAt:   time.Now().UTC(),
		Producer:     producer,
		Payload:      payload,
	}
	return envelope, envelope.Validate()
}

// Validate checks the envelope metadata and payload contract.
func (e EventEnvelope[T]) Validate() error {
	if e.EventID == "" {
		return fmt.Errorf("event_id is required")
	}
	if !eventTypePattern.MatchString(e.EventType) {
		return fmt.Errorf("event_type %q is invalid", e.EventType)
	}
	if e.EventVersion <= 0 {
		return fmt.Errorf("event_version must be greater than zero")
	}
	version, err := EventVersionFromType(e.EventType)
	if err != nil {
		return err
	}
	if e.EventVersion != version {
		return fmt.Errorf("event_version %d does not match event_type %q", e.EventVersion, e.EventType)
	}
	if e.OccurredAt.IsZero() {
		return fmt.Errorf("occurred_at is required")
	}
	if e.Producer == "" {
		return fmt.Errorf("producer is required")
	}
	if payload, ok := any(e.Payload).(Validatable); ok {
		if err := payload.Validate(); err != nil {
			return fmt.Errorf("payload validation failed: %w", err)
		}
	}
	return nil
}

// MarshalJSON validates the envelope before writing it.
func (e EventEnvelope[T]) MarshalJSON() ([]byte, error) {
	if err := e.Validate(); err != nil {
		return nil, err
	}
	type alias EventEnvelope[T]
	return json.Marshal(alias(e))
}

// EventVersionFromType parses the trailing version from an event type.
func EventVersionFromType(eventType string) (int, error) {
	idx := regexp.MustCompile(`\.v[1-9][0-9]*$`).FindStringIndex(eventType)
	if idx == nil {
		return 0, fmt.Errorf("event_type %q does not end with .vN", eventType)
	}
	raw := eventType[idx[0]+2:]
	version, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("event_type %q has invalid version: %w", eventType, err)
	}
	return version, nil
}
