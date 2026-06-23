package kafka

import "testing"

func TestTopicsReturnsCanonicalEventList(t *testing.T) {
	got := Topics()
	want := []string{
		TopicProjectDiscovered,
		TopicProjectSucceededDetected,
		TopicExamTryPassRequested,
		TopicRepoDownloadRequested,
		TopicRepoDownloaded,
		TopicRepoDownloadFailed,
		TopicQuestionsGenerationStarted,
		TopicQuestionsReady,
		TopicQuestionsGenerationFailed,
		TopicExamSubmitted,
		TopicExamPassed,
		TopicExamFailed,
	}

	if len(got) != len(want) {
		t.Fatalf("len(Topics()) = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("Topics()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTopicsAreVersioned(t *testing.T) {
	for _, topic := range Topics() {
		version, err := EventVersionFromType(topic)
		if err != nil {
			t.Fatalf("EventVersionFromType(%q) error = %v", topic, err)
		}
		if version != 1 {
			t.Fatalf("EventVersionFromType(%q) = %d, want 1", topic, version)
		}
	}
}
