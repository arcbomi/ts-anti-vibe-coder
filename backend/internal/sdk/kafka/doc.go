// Package kafka provides reusable Kafka producer, consumer, event envelope, and
// event topic helpers for backend services.
//
// The package is intentionally infrastructure-only. It does not contain
// service-specific business logic, database access, or HTTP concerns.
//
// Services can:
//   - load shared Kafka config from environment variables,
//   - publish JSON events using a shared envelope,
//   - consume events with at-least-once delivery semantics,
//   - reuse the canonical topic list and payload contracts.
package kafka
