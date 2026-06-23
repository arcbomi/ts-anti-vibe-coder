package kafka

import (
	"testing"
	"time"
)

func TestEventEnvelopeValidateAcceptsValidPayload(t *testing.T) {
	envelope := EventEnvelope[RepoDownloadedPayload]{
		EventID:      "evt-1",
		EventType:    TopicRepoDownloaded,
		EventVersion: 1,
		OccurredAt:   time.Now().UTC(),
		Producer:     "question-workflow",
		Payload: RepoDownloadedPayload{
			UserID:      "user-1",
			ProjectSlug: "go-reloaded",
			RepoURL:     "https://example.com/repo.git",
			AttemptID:   "attempt-1",
			LocalPath:   "/tmp/repo",
			CommitHash:  "abc123",
		},
	}

	if err := envelope.Validate(); err != nil {
		t.Fatalf("Validate() error = %v, want nil", err)
	}
}

func TestEventEnvelopeValidateRejectsVersionMismatch(t *testing.T) {
	envelope := EventEnvelope[RepoDownloadRequestedPayload]{
		EventID:      "evt-1",
		EventType:    TopicRepoDownloadRequested,
		EventVersion: 2,
		OccurredAt:   time.Now().UTC(),
		Producer:     "repo-service",
		Payload: RepoDownloadRequestedPayload{
			UserID:      "user-1",
			ProjectSlug: "go-reloaded",
			RepoURL:     "https://example.com/repo.git",
			AttemptID:   "attempt-1",
		},
	}

	if err := envelope.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want version mismatch")
	}
}

func TestEventEnvelopeValidateRejectsInvalidPayload(t *testing.T) {
	envelope := EventEnvelope[QuestionsReadyPayload]{
		EventID:      "evt-1",
		EventType:    TopicQuestionsReady,
		EventVersion: 1,
		OccurredAt:   time.Now().UTC(),
		Producer:     "question-workflow",
		Payload: QuestionsReadyPayload{
			UserID:      "user-1",
			ProjectSlug: "go-reloaded",
			AttemptID:   "attempt-1",
		},
	}

	if err := envelope.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want payload validation failure")
	}
}
