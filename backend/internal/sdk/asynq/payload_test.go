package asynqsdk

import "testing"

func TestMarshalAndUnmarshalTomorrowSyncProjectsPayload(t *testing.T) {
	t.Parallel()

	want := TomorrowSyncProjectsPayload{
		UserID:           "user-123",
		TomorrowUsername: "dmukhat",
		EventID:          "96",
	}

	var got TomorrowSyncProjectsPayload
	roundTripPayload(t, want, &got)

	if got != want {
		t.Fatalf("payload mismatch: got %#v want %#v", got, want)
	}
}

func TestMarshalAndUnmarshalRepoDownloadPayload(t *testing.T) {
	t.Parallel()

	want := RepoDownloadPayload{
		UserID:      "user-123",
		ProjectSlug: "go-reloaded",
		RepoURL:     "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded",
		AttemptID:   "attempt-1",
	}

	var got RepoDownloadPayload
	roundTripPayload(t, want, &got)

	if got != want {
		t.Fatalf("payload mismatch: got %#v want %#v", got, want)
	}
}

func TestMarshalAndUnmarshalQuestionsGeneratePayload(t *testing.T) {
	t.Parallel()

	want := QuestionsGeneratePayload{
		UserID:        "user-123",
		ProjectSlug:   "go-reloaded",
		AttemptID:     "attempt-1",
		RepoLocalPath: "/tmp/go-reloaded",
		CommitHash:    "abc123",
	}

	var got QuestionsGeneratePayload
	roundTripPayload(t, want, &got)

	if got != want {
		t.Fatalf("payload mismatch: got %#v want %#v", got, want)
	}
}

func TestMarshalAndUnmarshalRepoCleanupPayload(t *testing.T) {
	t.Parallel()

	want := RepoCleanupPayload{
		UserID:        "user-123",
		ProjectSlug:   "go-reloaded",
		AttemptID:     "attempt-1",
		RepoLocalPath: "/tmp/go-reloaded",
	}

	var got RepoCleanupPayload
	roundTripPayload(t, want, &got)

	if got != want {
		t.Fatalf("payload mismatch: got %#v want %#v", got, want)
	}
}

func TestDecodeTaskPayload(t *testing.T) {
	t.Parallel()

	want := RepoDownloadPayload{
		UserID:      "user-123",
		ProjectSlug: "go-reloaded",
		RepoURL:     "https://01.tomorrow-school.ai/git/dmukhat/go-reloaded",
		AttemptID:   "attempt-1",
	}

	task, err := NewRepoDownloadTask(want)
	if err != nil {
		t.Fatalf("NewRepoDownloadTask returned error: %v", err)
	}

	var got RepoDownloadPayload
	if err := DecodeTaskPayload(task, &got); err != nil {
		t.Fatalf("DecodeTaskPayload returned error: %v", err)
	}
	if got != want {
		t.Fatalf("payload mismatch: got %#v want %#v", got, want)
	}
}

func roundTripPayload[T any](t *testing.T, want T, dest *T) {
	t.Helper()

	data, err := MarshalPayload(want)
	if err != nil {
		t.Fatalf("MarshalPayload returned error: %v", err)
	}

	if err := UnmarshalPayload(data, dest); err != nil {
		t.Fatalf("UnmarshalPayload returned error: %v", err)
	}
}
